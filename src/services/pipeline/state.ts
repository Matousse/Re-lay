import { Annotation } from "@langchain/langgraph";
import type {
  Account,
  EnrichedContact,
  HumanDecision,
  LossAnalysis,
  OutreachDraft,
  Signal,
} from "@/types/pipeline";

export const PipelineState = Annotation.Root({
  signal: Annotation<Signal>,
  account: Annotation<Account | null>,
  lossAnalysis: Annotation<LossAnalysis | null>,
  targetContact: Annotation<EnrichedContact | null>,
  draft: Annotation<OutreachDraft | null>,
  humanDecision: Annotation<HumanDecision | null>,
  error: Annotation<string | null>,
});

export type PipelineStateType = typeof PipelineState.State;
