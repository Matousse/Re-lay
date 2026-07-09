import { PipelineState } from "@/services/pipeline/state";

it("expose les canaux d'état attendus", () => {
  const spec = (PipelineState as unknown as { spec: Record<string, unknown> }).spec;
  for (const key of [
    "signal",
    "account",
    "lossAnalysis",
    "targetContact",
    "draft",
    "humanDecision",
    "error",
  ]) {
    expect(spec).toHaveProperty(key);
  }
});
