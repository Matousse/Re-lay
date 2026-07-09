import { makeCrm } from "@/integrations/crm/factory";
import { makeEnrichment } from "@/integrations/enrichment/fullenrich";
import { makeSignalSource } from "@/integrations/signals/sillage";
import { makeAnthropicClient } from "@/integrations/llm/client";
import { buildGraph } from "@/services/pipeline/graph";

const crm = makeCrm();
export const signalSource = makeSignalSource();
export const pipeline = buildGraph({
  crm,
  enrichment: makeEnrichment(),
  llm: makeAnthropicClient(),
});
