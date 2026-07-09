import { normalizeCompanyName } from "@/lib/company";
import {
  ClosedLostAccountSchema,
  type Account,
  type ClosedLostAccount,
  type EnrichedContact,
  type Note,
} from "@/types/pipeline";
import type { CrmPort } from "@/integrations/crm/port";
import accounts from "@/integrations/crm/data.json";

// The seed rows carry richer fields than Account (domain, amount, the deal's
// contact) that the pipeline synthesises elsewhere; listClosedLostAccounts reads
// them directly. The seed has no per-contact location, so we default it — the
// user edits it in the persona-confirm step anyway.
type SeedAccount = Account & {
  domain?: string;
  amount?: number;
  contact?: { name: string; role: string; email: string };
};
const SEED_CONTACT_LOCATION = "France";

export class FakeCrm implements CrmPort {
  private accounts = accounts as SeedAccount[];
  writtenContacts: { accountId: string; contact: EnrichedContact }[] = [];
  writtenNotes: { accountId: string; text: string }[] = [];

  async findAccountByCompany(company: string): Promise<Account | null> {
    const exact = this.accounts.find((a) => a.company === company);
    if (exact) return exact;
    // Signals name companies as free text; fall back to a normalized match so a
    // "Qonto SAS"/"qonto" signal still resolves the seeded "Qonto" account.
    const target = normalizeCompanyName(company);
    return this.accounts.find((a) => normalizeCompanyName(a.company) === target) ?? null;
  }
  async getHistory(accountId: string): Promise<Note[]> {
    return this.accounts.find((a) => a.id === accountId)?.notes ?? [];
  }
  async writeContact(accountId: string, contact: EnrichedContact): Promise<void> {
    this.writtenContacts.push({ accountId, contact });
  }
  async writeNote(accountId: string, text: string): Promise<void> {
    this.writtenNotes.push({ accountId, text });
  }

  async listClosedLostAccounts(): Promise<ClosedLostAccount[]> {
    return this.accounts
      .filter((account) => account.status === "lost" && Boolean(account.domain))
      .map((account) =>
        ClosedLostAccountSchema.parse({
          id: account.id,
          company: account.company,
          domain: account.domain,
          amount: account.amount ?? null,
          lossReason: account.lossReason,
          contacts: account.contact
            ? [
                {
                  name: account.contact.name,
                  jobTitle: account.contact.role,
                  location: SEED_CONTACT_LOCATION,
                },
              ]
            : [],
        }),
      );
  }
}
