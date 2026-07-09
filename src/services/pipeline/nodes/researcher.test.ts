import { makeResearcherNode } from "@/services/pipeline/nodes/researcher";
import { FakeEnrichment } from "@/integrations/enrichment/fake";

it("enrichit le décideur cité par le signal", async () => {
  const node = makeResearcherNode(new FakeEnrichment());
  const patch = await node({
    signal: {
      id: "s",
      company: "Acme",
      type: "new_decision_maker",
      detail: "",
      personName: "Lea Blanc",
      personRole: "CMO",
    },
  } as never);
  expect(patch.targetContact?.name).toBe("Lea Blanc");
  expect(patch.targetContact?.email).toContain("@acme.com");
});
