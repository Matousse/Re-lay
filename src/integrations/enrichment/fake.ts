import type { EnrichedContact } from "@/types/pipeline";
import type { EnrichmentPort } from "@/integrations/enrichment/port";

export class FakeEnrichment implements EnrichmentPort {
  async enrich(input: {
    company: string;
    personName?: string;
    personRole?: string;
  }): Promise<EnrichedContact> {
    const name = input.personName ?? "Nouveau Décideur";
    const handle = name.toLowerCase().replace(/\s+/g, ".");
    const domain = input.company.toLowerCase().replace(/\s+/g, "") + ".com";
    return {
      name,
      role: input.personRole ?? "Décideur",
      email: `${handle}@${domain}`,
      mobile: "+33 6 12 34 56 78",
      location: "Paris, France",
    };
  }
}
