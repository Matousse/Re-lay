import { FakeCrm } from "@/integrations/crm/fake";
import { FakeEnrichment } from "@/integrations/enrichment/fake";
import { FakeSignalSource } from "@/integrations/signals/fake";
import { makeAnthropicClient } from "@/integrations/llm/client";
import { buildGraph } from "@/services/pipeline/graph";

const crm = new FakeCrm();
export const signalSource = new FakeSignalSource();
export const pipeline = buildGraph({
  crm,
  enrichment: new FakeEnrichment(),
  llm: makeAnthropicClient(),
});
