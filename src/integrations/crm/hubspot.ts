import { Client } from "@hubspot/api-client";
import {
  AccountSchema,
  NoteSchema,
  type Account,
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

// Standard, portal-default properties — safe to request without a 400.
const DEAL_PROPERTIES = ["hs_is_closed", "hs_is_closed_won", "closedate", "closed_lost_reason"];
const NOTE_PROPERTIES = ["hs_note_body", "hs_timestamp"];

// Derive the exact search-request type from the SDK instead of importing the
// internal FilterOperatorEnum (a deep, version-fragile path).
type CompanySearchRequest = Parameters<Client["crm"]["companies"]["searchApi"]["doSearch"]>[0];

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
      filterGroups: [
        { filters: [{ propertyName: "name", operator: "EQ" as never, value: company }] },
      ],
      properties: ["name"],
      limit: 1,
    };
    const result = await this.client.crm.companies.searchApi.doSearch(request);
    return result.results[0]?.id ?? null;
  }

  private async findContactIdByEmail(email: string): Promise<string | null> {
    const request: CompanySearchRequest = {
      filterGroups: [
        { filters: [{ propertyName: "email", operator: "EQ" as never, value: email }] },
      ],
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
        filterGroups: [
          {
            filters: [
              { propertyName: "hs_is_closed", operator: "EQ" as never, value: "true" },
              { propertyName: "hs_is_closed_won", operator: "EQ" as never, value: "false" },
            ],
          },
        ],
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
