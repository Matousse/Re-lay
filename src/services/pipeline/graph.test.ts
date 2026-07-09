import { Command } from "@langchain/langgraph";
import { buildGraph } from "@/services/pipeline/graph";
import { FakeCrm } from "@/integrations/crm/fake";
import { FakeEnrichment } from "@/integrations/enrichment/fake";
import { LossAnalysisSchema, OutreachDraftSchema } from "@/types/pipeline";
import type { LlmClient } from "@/integrations/llm/client";

type WithInterrupt = { __interrupt__?: Array<{ value: { draft: { subject: string } } }> };

const stubLlm: LlmClient = {
  structured: async <T>({ schema }: { system: string; user: string; schema: unknown }) => {
    if ((schema as unknown) === (LossAnalysisSchema as unknown)) {
      return { rootCause: "budget", evidence: ["x"], newAngle: "y" } as T;
    }
    if ((schema as unknown) === (OutreachDraftSchema as unknown)) {
      return { subject: "Hello", body: "Corps", rationale: "z" } as T;
    }
    throw new Error("schéma inattendu");
  },
};

const signal = {
  id: "sig_1",
  company: "Acme",
  type: "new_decision_maker" as const,
  detail: "",
  personName: "Lea Blanc",
  personRole: "CMO",
};

it("s'arrête sur l'interrupt puis écrit au CRM après approbation", async () => {
  const crm = new FakeCrm();
  const graph = buildGraph({ crm, enrichment: new FakeEnrichment(), llm: stubLlm });
  const config = { configurable: { thread_id: "t1" } };

  const paused = (await graph.invoke({ signal }, config)) as WithInterrupt;
  expect(paused.__interrupt__).toBeDefined();
  expect(paused.__interrupt__?.[0].value.draft.subject).toBe("Hello");

  await graph.invoke(new Command({ resume: { type: "approve" } }), config);
  expect(crm.writtenContacts.length).toBe(1);
  expect(crm.writtenNotes[0].text).toContain("Hello");
});

it("coupe court (END) si le compte est actif", async () => {
  const crm = new FakeCrm();
  const graph = buildGraph({ crm, enrichment: new FakeEnrichment(), llm: stubLlm });
  const result = (await graph.invoke(
    { signal: { ...signal, company: "Globex" } },
    { configurable: { thread_id: "t2" } },
  )) as WithInterrupt;
  expect(result.__interrupt__).toBeUndefined();
  expect(crm.writtenContacts.length).toBe(0);
});
