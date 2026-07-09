import { makeAnalystNode } from "@/services/pipeline/nodes/analyst";
import { FakeCrm } from "@/integrations/crm/fake";
import type { LlmClient } from "@/integrations/llm/client";

const stubLlm: LlmClient = {
  structured: async <T>() =>
    ({ rootCause: "budget", evidence: ["CMO trop cher"], newAngle: "nouveau CMO" }) as T,
};

it("produit une analyse de perte à partir de l'historique", async () => {
  const account = {
    id: "acc_1",
    company: "Acme",
    status: "lost" as const,
    lossReason: "budget",
    lostAt: "2024-03-10",
    notes: [],
  };
  const node = makeAnalystNode(new FakeCrm(), stubLlm);
  const patch = await node({
    signal: { id: "s", company: "Acme", type: "new_decision_maker", detail: "" },
    account,
  } as never);
  expect(patch.lossAnalysis?.rootCause).toBe("budget");
});
