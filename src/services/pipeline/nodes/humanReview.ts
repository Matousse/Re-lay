import { interrupt } from "@langchain/langgraph";
import type { HumanDecision } from "@/types/pipeline";
import type { PipelineStateType } from "@/services/pipeline/state";

export function makeHumanReviewNode() {
  return async (state: PipelineStateType): Promise<Partial<PipelineStateType>> => {
    const decision = interrupt({
      draft: state.draft,
      targetContact: state.targetContact,
    }) as HumanDecision;
    if (decision.type === "edit") return { humanDecision: decision, draft: decision.draft };
    return { humanDecision: decision };
  };
}
