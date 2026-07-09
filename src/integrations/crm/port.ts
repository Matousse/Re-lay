import type { Account, ClosedLostAccount, EnrichedContact, Note } from "@/types/pipeline";

export interface CrmPort {
  findAccountByCompany(company: string): Promise<Account | null>;
  getHistory(accountId: string): Promise<Note[]>;
  writeContact(accountId: string, contact: EnrichedContact): Promise<void>;
  writeNote(accountId: string, text: string): Promise<void>;
  // Every closed-lost account that carries a domain — the revival pool Re:lay
  // pushes to Sillage as target accounts. Domain-less accounts are skipped
  // (Sillage resolves poorly on company names).
  listClosedLostAccounts(): Promise<ClosedLostAccount[]>;
}
