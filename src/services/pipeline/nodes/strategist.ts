import { END } from "@langchain/langgraph";
import type { LlmClient } from "@/integrations/llm/client";
import { OutreachDraftSchema } from "@/types/pipeline";
import type { PipelineStateType } from "@/services/pipeline/state";

export function makeStrategistNode(llm: LlmClient) {
  return async (state: PipelineStateType): Promise<Partial<PipelineStateType>> => {
    const draft = await llm.structured({
      schema: OutreachDraftSchema,
      system:
        "Tu es SDR. Rédige un message de relance court et personnalisé, justifié par l'échec passé (lossAnalysis) et le nouveau contexte (signal). Ton professionnel, pas de blabla.",
      user: JSON.stringify({
        signal: state.signal,
        lossAnalysis: state.lossAnalysis,
        contact: state.targetContact,
      }),
    });
    return { draft };
  };
}

export function routeOnDecision(state: PipelineStateType): "syncCrm" | typeof END {
  const t = state.humanDecision?.type;
  return t === "approve" || t === "edit" ? "syncCrm" : END;
}
