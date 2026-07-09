import { END } from "@langchain/langgraph";
import type { CrmPort } from "@/integrations/crm/port";
import type { PipelineStateType } from "@/services/pipeline/state";

export function makeQualifyNode(crm: CrmPort) {
  return async (state: PipelineStateType): Promise<Partial<PipelineStateType>> => {
    const account = await crm.findAccountByCompany(state.signal.company);
    if (!account) return { account: null, error: `Compte introuvable : ${state.signal.company}` };
    return { account };
  };
}

export function routeOnStatus(state: PipelineStateType): "analyst" | typeof END {
  return state.account?.status === "lost" ? "analyst" : END;
}
