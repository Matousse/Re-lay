import { makeStrategistNode, routeOnDecision } from "@/services/pipeline/nodes/strategist";
import type { LlmClient } from "@/integrations/llm/client";

const stubLlm: LlmClient = {
  structured: async <T>() =>
    ({ subject: "On reparle ?", body: "Bonjour Lea...", rationale: "nouveau CMO" }) as T,
};

it("génère un brouillon d'approche", async () => {
  const node = makeStrategistNode(stubLlm);
  const patch = await node({
    signal: { id: "s", company: "Acme", type: "new_decision_maker", detail: "" },
    lossAnalysis: { rootCause: "budget", evidence: [], newAngle: "x" },
    targetContact: { name: "Lea", role: "CMO", email: "a@b.c", mobile: "", location: "" },
  } as never);
  expect(patch.draft?.subject).toBe("On reparle ?");
});

it("route vers syncCrm si approuvé, END si rejeté", () => {
  expect(routeOnDecision({ humanDecision: { type: "approve" } } as never)).toBe("syncCrm");
  expect(routeOnDecision({ humanDecision: { type: "reject" } } as never)).toBe("__end__");
});
