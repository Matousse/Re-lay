import { FakeCrm } from "@/integrations/crm/fake";
import { FakeEnrichment } from "@/integrations/enrichment/fake";
import { makeSignalSource } from "@/integrations/signals/sillage";
import { makeAnthropicClient } from "@/integrations/llm/client";
import { buildGraph } from "@/services/pipeline/graph";

const crm = new FakeCrm();
export const signalSource = makeSignalSource();
export const pipeline = buildGraph({
  crm,
  enrichment: new FakeEnrichment(),
  llm: makeAnthropicClient(),
});
