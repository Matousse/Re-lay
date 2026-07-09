import type { Account, EnrichedContact, Note } from "@/types/pipeline";

export interface CrmPort {
  findAccountByCompany(company: string): Promise<Account | null>;
  getHistory(accountId: string): Promise<Note[]>;
  writeContact(accountId: string, contact: EnrichedContact): Promise<void>;
  writeNote(accountId: string, text: string): Promise<void>;
}
