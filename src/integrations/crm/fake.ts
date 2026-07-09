import type { Account, EnrichedContact, Note } from "@/types/pipeline";
import type { CrmPort } from "@/integrations/crm/port";
import accounts from "@/integrations/crm/data.json";

export class FakeCrm implements CrmPort {
  private accounts = accounts as Account[];
  writtenContacts: { accountId: string; contact: EnrichedContact }[] = [];
  writtenNotes: { accountId: string; text: string }[] = [];

  async findAccountByCompany(company: string): Promise<Account | null> {
    return this.accounts.find((a) => a.company === company) ?? null;
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
}
