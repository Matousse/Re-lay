import type { CrmPort } from "@/integrations/crm/port";
import type { LlmClient } from "@/integrations/llm/client";
import { LossAnalysisSchema } from "@/types/pipeline";
import type { PipelineStateType } from "@/services/pipeline/state";

export function makeAnalystNode(crm: CrmPort, llm: LlmClient) {
  return async (state: PipelineStateType): Promise<Partial<PipelineStateType>> => {
    const account = state.account!;
    const history = await crm.getHistory(account.id);
    const lossAnalysis = await llm.structured({
      schema: LossAnalysisSchema,
      system:
        "Tu es analyste commercial. À partir du champ lossReason ET des notes, déduis la vraie raison de l'échec passé, cite les preuves issues des notes, et propose un nouvel angle de relance tenant compte du signal récent.",
      user: JSON.stringify({ signal: state.signal, account, history }),
    });
    return { lossAnalysis };
  };
}
