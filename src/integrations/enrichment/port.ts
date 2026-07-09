import type { EnrichedContact } from "@/types/pipeline";

export interface EnrichmentPort {
  enrich(input: {
    company: string;
    personName?: string;
    personRole?: string;
  }): Promise<EnrichedContact>;
}
