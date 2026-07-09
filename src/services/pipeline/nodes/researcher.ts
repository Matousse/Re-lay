import type { EnrichmentPort } from "@/integrations/enrichment/port";
import type { PipelineStateType } from "@/services/pipeline/state";

export function makeResearcherNode(enrichment: EnrichmentPort) {
  return async (state: PipelineStateType): Promise<Partial<PipelineStateType>> => {
    const targetContact = await enrichment.enrich({
      company: state.signal.company,
      personName: state.signal.personName,
      personRole: state.signal.personRole,
    });
    return { targetContact };
  };
}
