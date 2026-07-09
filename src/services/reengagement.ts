import { fetchConnectorStates, resetConnectors } from "@/integrations/connectors";
import {
  activateSimulatedCase,
  fetchCase,
  fetchCases,
  persistDecision,
  resetDemo,
} from "@/integrations/pipeline";
import { notifyPlayApproved } from "@/integrations/notifications/slack";
import { getPipelineBridge } from "@/services/pipeline-bridge";
import type { DecisionEffects, DecisionInput, ReengagementCase } from "@/types/reengagement";

// The pipeline only produces cases once the whole stack is connected — no
// signal engine (or CRM, or enrichment), no plays.
async function pipelineOnline(): Promise<boolean> {
  const states = await fetchConnectorStates();
  return Object.values(states).every(Boolean);
}

const STATUS_ORDER: Record<ReengagementCase["status"], number> = {
  pending_review: 0,
  approved: 1,
  rejected: 2,
  no_go: 3,
};

// Curated demo cases plus everything produced by real LangGraph runs.
async function fetchAllCases(): Promise<ReengagementCase[]> {
  return [...(await fetchCases()), ...getPipelineBridge().list()];
}

export async function listCases(): Promise<ReengagementCase[]> {
  if (!(await pipelineOnline())) return [];
  const cases = await fetchAllCases();
  return cases.toSorted(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.verdict.score - a.verdict.score,
  );
}

export async function getCase(id: string): Promise<ReengagementCase | null> {
  if (!(await pipelineOnline())) return null;
  return (await fetchCase(id)) ?? getPipelineBridge().get(id);
}

export type PipelineStats = {
  signalsMatched: number;
  goVerdicts: number;
  pendingReview: number;
  revivablePipeline: number;
};

export async function getStats(): Promise<PipelineStats> {
  if (!(await pipelineOnline())) {
    return { signalsMatched: 0, goVerdicts: 0, pendingReview: 0, revivablePipeline: 0 };
  }
  const cases = await fetchAllCases();
  const go = cases.filter((c) => c.verdict.decision === "go");
  return {
    signalsMatched: cases.length,
    goVerdicts: go.length,
    pendingReview: cases.filter((c) => c.status === "pending_review").length,
    revivablePipeline: go
      .filter((c) => c.status !== "rejected")
      .reduce((sum, c) => sum + c.deal.amount, 0),
  };
}

export async function simulateIncomingSignal(): Promise<ReengagementCase | null> {
  if (!(await pipelineOnline())) return null;
  return activateSimulatedCase();
}

export type PipelineRunResult =
  { ok: true; case: ReengagementCase } | { ok: false; reason: "offline" | "not_eligible" };

// Runs the real LangGraph pipeline on a signal, up to the humanReview
// interrupt. The resulting case then flows through the same list/detail/
// decision screens as the curated ones.
export async function runPipelineForSignal(signalId: string): Promise<PipelineRunResult> {
  if (!(await pipelineOnline())) return { ok: false, reason: "offline" };
  const reengagementCase = await getPipelineBridge().runSignal(signalId);
  if (!reengagementCase) return { ok: false, reason: "not_eligible" };
  return { ok: true, case: reengagementCase };
}

export async function resetDemoState(): Promise<void> {
  await resetDemo();
  await resetConnectors();
  getPipelineBridge().reset();
}

export type DecisionOutcome = { case: ReengagementCase; effects: DecisionEffects };

export async function decideCase(
  id: string,
  input: DecisionInput,
): Promise<DecisionOutcome | null> {
  const updated = getPipelineBridge().has(id)
    ? await getPipelineBridge().decide(id, input)
    : await decideMockCase(id, input);
  if (!updated) return null;

  // Approving a play triggers the downstream actions: the CRM sync (the
  // graph's syncCrm node for real runs, described for curated cases) and a
  // Slack announcement when a webhook is configured.
  const approved = input.action === "approve";
  const effects: DecisionEffects = {
    crmSynced: approved,
    slackNotified: approved ? await notifyPlayApproved(updated, input.angleLabel) : false,
    syncedAt: new Date().toISOString(),
  };
  return { case: updated, effects };
}

// Cases born from a LangGraph run resume their interrupted thread (handled in
// the bridge); curated demo cases just persist the decision here.
async function decideMockCase(id: string, input: DecisionInput): Promise<ReengagementCase | null> {
  const existing = await fetchCase(id);
  if (!existing || existing.status !== "pending_review") return null;
  const status = input.action === "approve" ? "approved" : "rejected";
  return persistDecision(
    id,
    status,
    input.action === "approve" ? input.email : undefined,
    input.action === "approve" ? input.angleLabel : undefined,
  );
}
