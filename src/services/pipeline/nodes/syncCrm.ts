import type { CrmPort } from "@/integrations/crm/port";
import type { PipelineStateType } from "@/services/pipeline/state";

export function makeSyncCrmNode(crm: CrmPort) {
  return async (state: PipelineStateType): Promise<Partial<PipelineStateType>> => {
    const account = state.account!;
    if (state.targetContact) await crm.writeContact(account.id, state.targetContact);
    if (state.draft) await crm.writeNote(account.id, `Relance: ${state.draft.subject}`);
    return {};
  };
}
