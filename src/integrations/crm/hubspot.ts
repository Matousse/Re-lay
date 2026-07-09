import { Client } from "@hubspot/api-client";
import { mapWithConcurrency, withRetry } from "@/lib/async";
import {
  AccountSchema,
  ClosedLostAccountSchema,
  NoteSchema,
  type Account,
  type ClosedLostAccount,
  type ClosedLostContact,
  type EnrichedContact,
  type Note,
} from "@/types/pipeline";
import type { CrmPort } from "@/integrations/crm/port";

// Real CRM port backed by the HubSpot API. Maps HubSpot's object model
// (company ↔ deals ↔ notes/contacts) onto the flat Account the pipeline
// expects. Only ever built through makeCrm() when HUBSPOT_ACCESS_TOKEN is set —
// otherwise the demo stays on FakeCrm.
//
// Reads are first-page only (see PAGE_LIMIT): enough for a hackathon portal,
// but it means a company with 100+ notes would surface only the newest slice.

const PAGE_LIMIT = 100;

// Cap concurrent HubSpot reads. The per-deal and per-company detail lookups fan
// out, and firing them all at once (a bare Promise.all) would burst past
// HubSpot's rate limit on a large portal. A small pool keeps us under it;
// withRetry rides out the occasional 429.
const READ_CONCURRENCY = 5;

// Derive the search-request shape — and its nested filter — from the SDK instead
// of importing the internal FilterOperatorEnum (a deep, version-fragile path).
type CompanySearchRequest = Parameters<Client["crm"]["companies"]["searchApi"]["doSearch"]>[0];
type SearchFilter = NonNullable<CompanySearchRequest["filterGroups"]>[number]["filters"][number];

// The comparison operators Re:lay actually uses, typed locally so a typo is a
// compile error — without pulling in the SDK's fragile enum path. The single
// cast is contained here rather than sprinkled as `as never` at every call site.
type FilterOperator = "EQ" | "NEQ" | "GT" | "GTE" | "LT" | "LTE" | "HAS_PROPERTY";

function searchFilter(propertyName: string, operator: FilterOperator, value: string): SearchFilter {
  return { propertyName, operator, value } as SearchFilter;
}

// Standard, portal-default properties — safe to request without a 400.
const DEAL_PROPERTIES = ["hs_is_closed", "hs_is_closed_won", "closedate", "closed_lost_reason"];
const NOTE_PROPERTIES = ["hs_note_body", "hs_timestamp"];
const CONTACT_PROPERTIES = ["firstname", "lastname", "jobtitle", "city", "country"];
const CLOSED_LOST_FILTERS = [
  searchFilter("hs_is_closed", "EQ", "true"),
  searchFilter("hs_is_closed_won", "EQ", "false"),
];

// A closed-lost deal reduced to what the Sillage sync needs, plus which company
// and contacts it links to (resolved in a second pass).
type DealFacts = { id: string; amount: number | null; lossReason: string | null };
type DealLinks = { dealId: string; companyId?: string; contactIds: string[] };
type CompanyFacts = { name: string; domain: string | null; contactIds: string[] };

export class HubSpotCrm implements CrmPort {
  private client: Client;

  constructor(accessToken: string) {
    this.client = new Client({ accessToken });
  }

  async findAccountByCompany(company: string): Promise<Account | null> {
    const companyId = await this.searchCompanyId(company);
    if (!companyId) return null;

    const withAssociations = await this.client.crm.companies.basicApi.getById(
      companyId,
      ["name"],
      undefined,
      ["deals", "notes"],
    );

    // HubSpot can return an association twice (once per label); dedupe so a
    // single note/deal never lands in the account more than once.
    const dealIds = uniq(withAssociations.associations?.deals?.results.map((r) => r.id));
    const noteIds = uniq(withAssociations.associations?.notes?.results.map((r) => r.id));

    const [dealStatus, notes] = await Promise.all([
      this.deriveStatus(dealIds),
      this.readNotes(noteIds),
    ]);

    return AccountSchema.parse({
      id: companyId,
      company: withAssociations.properties.name ?? company,
      status: dealStatus.status,
      lossReason: dealStatus.lossReason,
      lostAt: dealStatus.lostAt,
      notes,
    });
  }

  async getHistory(accountId: string): Promise<Note[]> {
    const withAssociations = await this.client.crm.companies.basicApi.getById(
      accountId,
      ["name"],
      undefined,
      ["notes"],
    );
    const noteIds = uniq(withAssociations.associations?.notes?.results.map((r) => r.id));
    return this.readNotes(noteIds);
  }

  // The revival pool: every closed-lost deal, grouped by its company, keeping
  // only companies that carry a domain. Deal search gives the money + loss
  // reason; a per-deal association read links each to its company and contacts,
  // then two batch reads resolve the company domain and the contacts' titles and
  // locations. First-page only (PAGE_LIMIT deals), same as the rest of this port.
  async listClosedLostAccounts(): Promise<ClosedLostAccount[]> {
    const deals = await this.searchClosedLostDeals();
    if (deals.length === 0) return [];

    const links = await this.readDealLinks(deals.map((deal) => deal.id));
    const companyIds = uniq(
      links.map((link) => link.companyId).filter((id): id is string => Boolean(id)),
    );
    const companies = await this.readCompanyDetails(companyIds);

    // Contacts live on the company as often as on the deal — union both, so the
    // persona is derived from real people even in portals that only associate
    // contacts to companies (which is why a deal-only read came back empty).
    const contactIds = uniq([
      ...links.flatMap((link) => link.contactIds),
      ...[...companies.values()].flatMap((company) => company.contactIds),
    ]);
    const contacts = await this.readContacts(contactIds);

    return groupByCompany(deals, links, companies, contacts);
  }

  async writeContact(accountId: string, contact: EnrichedContact): Promise<void> {
    const [firstname, ...rest] = contact.name.split(" ");
    const properties: Record<string, string> = {
      firstname: firstname ?? contact.name,
      lastname: rest.join(" "),
      email: contact.email,
      jobtitle: contact.role,
      phone: contact.mobile,
    };

    let contactId: string;
    try {
      const created = await this.client.crm.contacts.basicApi.create({
        properties,
        associations: [],
      });
      contactId = created.id;
    } catch {
      // Most likely a 409: a contact with that email already exists. Reuse it
      // instead of failing the sync.
      const existing = await this.findContactIdByEmail(contact.email);
      if (!existing) throw new Error(`HubSpot: could not create or find contact ${contact.email}`);
      contactId = existing;
    }

    await this.client.crm.associations.v4.basicApi.createDefault(
      "contacts",
      contactId,
      "companies",
      accountId,
    );
  }

  async writeNote(accountId: string, text: string): Promise<void> {
    const note = await this.client.crm.objects.notes.basicApi.create({
      properties: { hs_note_body: text, hs_timestamp: new Date().toISOString() },
      associations: [],
    });
    await this.client.crm.associations.v4.basicApi.createDefault(
      "notes",
      note.id,
      "companies",
      accountId,
    );
  }

  private async searchCompanyId(company: string): Promise<string | null> {
    const request: CompanySearchRequest = {
      filterGroups: [{ filters: [searchFilter("name", "EQ", company)] }],
      properties: ["name"],
      limit: 1,
    };
    const result = await this.client.crm.companies.searchApi.doSearch(request);
    return result.results[0]?.id ?? null;
  }

  private async findContactIdByEmail(email: string): Promise<string | null> {
    const request: CompanySearchRequest = {
      filterGroups: [{ filters: [searchFilter("email", "EQ", email)] }],
      properties: ["email"],
      limit: 1,
    };
    const result = await this.client.crm.contacts.searchApi.doSearch(request);
    return result.results[0]?.id ?? null;
  }

  // A company can carry several deals. We surface the account as "lost" as soon
  // as one deal is closed-lost (the revival target Re:lay cares about), "won"
  // if one is closed-won, else "active" — using the most recent closed-lost
  // deal for the loss reason and date.
  private async deriveStatus(
    dealIds: string[],
  ): Promise<Pick<Account, "status" | "lossReason" | "lostAt">> {
    if (dealIds.length === 0) return { status: "active", lossReason: null, lostAt: null };

    const batch = await this.client.crm.deals.batchApi.read({
      inputs: dealIds.map((id) => ({ id })),
      properties: DEAL_PROPERTIES,
      propertiesWithHistory: [],
    });

    let lostDeal: { lossReason: string | null; lostAt: string | null } | null = null;
    let hasWon = false;

    for (const deal of batch.results) {
      const props = deal.properties;
      const closed = props.hs_is_closed === "true";
      const won = props.hs_is_closed_won === "true";
      if (closed && won) hasWon = true;
      if (closed && !won) {
        const lostAt = props.closedate ?? null;
        // Keep the most recent closed-lost deal.
        if (!lostDeal || (lostAt && lostDeal.lostAt && lostAt > lostDeal.lostAt)) {
          lostDeal = { lossReason: props.closed_lost_reason ?? null, lostAt };
        }
      }
    }

    if (lostDeal)
      return { status: "lost", lossReason: lostDeal.lossReason, lostAt: lostDeal.lostAt };
    if (hasWon) return { status: "won", lossReason: null, lostAt: null };
    return { status: "active", lossReason: null, lostAt: null };
  }

  private async readNotes(noteIds: string[]): Promise<Note[]> {
    if (noteIds.length === 0) return [];

    const batch = await this.client.crm.objects.notes.batchApi.read({
      inputs: noteIds.slice(0, PAGE_LIMIT).map((id) => ({ id })),
      properties: NOTE_PROPERTIES,
      propertiesWithHistory: [],
    });

    const notes = batch.results
      .map((note) => ({
        date: toIsoDate(note.properties.hs_timestamp),
        // HubSpot notes have no cheap author-name field on the note itself
        // (only an owner id needing a second call); the note body is what the
        // analyst node reads, so we tag the source rather than pay for it.
        author: "HubSpot",
        text: stripHtml(note.properties.hs_note_body ?? ""),
      }))
      .filter((note) => note.text.length > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    return NoteSchema.array().parse(notes);
  }

  private async searchClosedLostDeals(): Promise<DealFacts[]> {
    const request: CompanySearchRequest = {
      filterGroups: [{ filters: CLOSED_LOST_FILTERS }],
      properties: ["amount", "closed_lost_reason"],
      limit: PAGE_LIMIT,
    };
    const result = await this.client.crm.deals.searchApi.doSearch(request);
    return result.results.map((deal) => ({
      id: deal.id,
      amount: toAmount(deal.properties.amount),
      lossReason: deal.properties.closed_lost_reason ?? null,
    }));
  }

  private async readDealLinks(dealIds: string[]): Promise<DealLinks[]> {
    return mapWithConcurrency(dealIds, READ_CONCURRENCY, async (dealId) => {
      const deal = await withRetry(() =>
        this.client.crm.deals.basicApi.getById(dealId, undefined, undefined, [
          "companies",
          "contacts",
        ]),
      );
      return {
        dealId,
        companyId: deal.associations?.companies?.results[0]?.id,
        contactIds: uniq(deal.associations?.contacts?.results.map((r) => r.id)),
      };
    });
  }

  // Per-company (not batch) so we can pull the company's associated contacts in
  // the same call — batchApi.read returns properties but no associations.
  private async readCompanyDetails(ids: string[]): Promise<Map<string, CompanyFacts>> {
    if (ids.length === 0) return new Map();
    const companies = await mapWithConcurrency(ids, READ_CONCURRENCY, async (id) => {
      const company = await withRetry(() =>
        this.client.crm.companies.basicApi.getById(id, ["name", "domain"], undefined, ["contacts"]),
      );
      return [
        id,
        {
          name: company.properties.name ?? "",
          domain: company.properties.domain ?? null,
          contactIds: uniq(company.associations?.contacts?.results.map((r) => r.id)),
        },
      ] as const;
    });
    return new Map(companies);
  }

  private async readContacts(ids: string[]): Promise<Map<string, ClosedLostContact>> {
    if (ids.length === 0) return new Map();
    const batch = await this.client.crm.contacts.batchApi.read({
      inputs: ids.map((id) => ({ id })),
      properties: CONTACT_PROPERTIES,
      propertiesWithHistory: [],
    });
    return new Map(
      batch.results.map((contact) => {
        const props = contact.properties;
        const name = [props.firstname, props.lastname].filter(Boolean).join(" ").trim();
        return [
          contact.id,
          {
            name: name || "Contact",
            jobTitle: props.jobtitle ?? "",
            location: formatLocation(props.city, props.country),
          },
        ];
      }),
    );
  }
}

// Lightweight liveness probe for the real portal: one authenticated search
// (limit 1) that both proves the token works and returns the total company
// count. Kept out of the class so the health route can call it without spinning
// up a full CrmPort.
export async function verifyHubSpotConnection(
  accessToken: string,
): Promise<
  | { ok: true; companies: number; closedLost: number; contacts: number }
  | { ok: false; error: string }
> {
  try {
    const client = new Client({ accessToken });
    const [companies, lost, contacts] = await Promise.all([
      client.crm.companies.searchApi.doSearch({
        filterGroups: [],
        properties: ["name"],
        limit: 1,
      }),
      // Closed-lost deals = the revivable pool Re:lay works on.
      client.crm.deals.searchApi.doSearch({
        filterGroups: [{ filters: CLOSED_LOST_FILTERS }],
        properties: ["dealname"],
        limit: 1,
      }),
      client.crm.contacts.searchApi.doSearch({
        filterGroups: [],
        properties: ["email"],
        limit: 1,
      }),
    ]);
    return {
      ok: true,
      companies: companies.total ?? companies.results.length,
      closedLost: lost.total ?? lost.results.length,
      contacts: contacts.total ?? contacts.results.length,
    };
  } catch (err: unknown) {
    const e = err as { code?: number; body?: { message?: string }; message?: string };
    if (e.code === 401) return { ok: false, error: "Token invalid or expired" };
    return { ok: false, error: e.body?.message ?? e.message ?? "HubSpot unreachable" };
  }
}

function uniq(ids: string[] | undefined): string[] {
  return [...new Set(ids ?? [])];
}

// One account per company with a domain (Sillage resolves poorly on names). Its
// contacts are the union of the company's own contacts and those on its lost
// deals; its money/reason come from one of those deals.
function groupByCompany(
  deals: DealFacts[],
  links: DealLinks[],
  companies: Map<string, CompanyFacts>,
  contacts: Map<string, ClosedLostContact>,
): ClosedLostAccount[] {
  const dealById = new Map(deals.map((deal) => [deal.id, deal]));
  const accounts: ClosedLostAccount[] = [];

  for (const [companyId, company] of companies) {
    if (!company.domain) continue;

    const companyLinks = links.filter((link) => link.companyId === companyId);
    const contactIds = new Set(company.contactIds);
    for (const link of companyLinks) for (const id of link.contactIds) contactIds.add(id);

    const deal = companyLinks.map((link) => dealById.get(link.dealId)).find(Boolean);
    const accountContacts = [...contactIds]
      .map((id) => contacts.get(id))
      .filter((contact): contact is ClosedLostContact => Boolean(contact));

    accounts.push(
      ClosedLostAccountSchema.parse({
        id: companyId,
        company: company.name || company.domain,
        domain: company.domain,
        amount: deal?.amount ?? null,
        lossReason: deal?.lossReason ?? null,
        contacts: dedupeContacts(accountContacts),
      }),
    );
  }

  return accounts;
}

function dedupeContacts(contacts: ClosedLostContact[]): ClosedLostContact[] {
  const seen = new Map<string, ClosedLostContact>();
  for (const contact of contacts) seen.set(`${contact.name}|${contact.jobTitle}`, contact);
  return [...seen.values()];
}

function formatLocation(city?: string | null, country?: string | null): string {
  return [city, country].filter(Boolean).join(", ");
}

// HubSpot amounts come back as strings; the persona/summary want a number.
function toAmount(raw?: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

// HubSpot note bodies are rich text (HTML); the pipeline wants plain text.
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// hs_timestamp comes back either as ISO-8601 or epoch millis depending on the
// property; normalise to a YYYY-MM-DD string.
function toIsoDate(raw?: string | null): string {
  if (!raw) return "";
  const iso = /^\d+$/.test(raw) ? new Date(Number(raw)).toISOString() : raw;
  return iso.slice(0, 10);
}
