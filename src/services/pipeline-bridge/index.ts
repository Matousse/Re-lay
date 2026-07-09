import { randomUUID } from "node:crypto";
import { Command } from "@langchain/langgraph";
import { FakeCrm } from "@/integrations/crm/fake";
import { makeEnrichment } from "@/integrations/enrichment/fullenrich";
import { makeAnthropicClient } from "@/integrations/llm/client";
import { FakeLlm } from "@/integrations/llm/fake";
import { makeSignalSource } from "@/integrations/signals/sillage";
import { env } from "@/lib/env";
import type { CrmPort } from "@/integrations/crm/port";
import type { EnrichmentPort } from "@/integrations/enrichment/port";
import type { LlmClient } from "@/integrations/llm/client";
import type { SignalSource } from "@/integrations/signals/port";
import { buildGraph } from "@/services/pipeline/graph";
import { toReengagementCase } from "@/services/pipeline-bridge/map";
import type { PipelineStateType } from "@/services/pipeline/state";
import type { HumanDecision, Signal } from "@/types/pipeline";
import type { DecisionInput, ReengagementCase } from "@/types/reengagement";

// Runs the LangGraph pipeline behind the front's ReengagementCase contract:
// start a run from a signal, surface the humanReview interrupt as a
// pending_review case, and resume the exact same thread when the rep decides.
// Builds its own graph instance so nothing here touches the pipeline
// singleton in services/pipeline/index.ts (which requires ANTHROPIC_API_KEY at
// import time) — every dep is injected and gated on its key: real when the
// key is present, offline fake otherwise.

type BridgeDeps = {
  crm: CrmPort;
  enrichment: EnrichmentPort;
  llm: LlmClient;
  signals: SignalSource;
};

type InterruptedState = PipelineStateType & { __interrupt__?: Array<{ value: unknown }> };

function defaultDeps(): BridgeDeps {
  return {
    crm: new FakeCrm(),
    // Real FullEnrich when FULL_ENRICH_API_KEY is set, fake otherwise.
    enrichment: makeEnrichment(),
    // Real Claude when ANTHROPIC_API_KEY is set, deterministic fake otherwise.
    llm: env.ANTHROPIC_API_KEY ? makeAnthropicClient() : new FakeLlm(),
    // Real Sillage workspace when SILLAGE_API_KEY is set, seeded fake
    // otherwise.
    signals: makeSignalSource(),
  };
}

export class PipelineBridge {
  private cases = new Map<string, ReengagementCase>();
  private threads = new Map<string, string>();
  private graph: ReturnType<typeof buildGraph>;

  constructor(
    private deps: BridgeDeps = defaultDeps(),
    private now: () => Date = () => new Date(),
  ) {
    this.graph = buildGraph(deps);
  }

  // Signals the pipeline can be run on (real Sillage workspace or the seeded
  // fake) — lets callers like the MCP server discover valid signal ids.
  async listSignals(): Promise<Signal[]> {
    return this.deps.signals.list();
  }

  // Runs the graph until the humanReview interrupt. Returns null when the
  // graph ends early instead (unknown company, or an account that is not
  // lost — nothing to revive).
  async runSignal(signalId: string): Promise<ReengagementCase | null> {
    const signal = await this.deps.signals.getById(signalId);
    if (!signal) return null;

    const threadId = randomUUID();
    const result = (await this.graph.invoke(
      { signal },
      { configurable: { thread_id: threadId } },
    )) as InterruptedState;
    if (!result.__interrupt__) return null;

    const caseId = `run-${threadId.slice(0, 8)}`;
    const reengagementCase = toReengagementCase({ state: result, caseId, now: this.now() });
    this.cases.set(caseId, reengagementCase);
    this.threads.set(caseId, threadId);
    return reengagementCase;
  }

  // Resumes the interrupted thread with the rep's decision, then mirrors the
  // outcome on the stored case (plan.emailDraft always stays the agent's
  // original so the front can diff it against editedEmail).
  async decide(caseId: string, input: DecisionInput): Promise<ReengagementCase | null> {
    const existing = this.cases.get(caseId);
    const threadId = this.threads.get(caseId);
    if (!existing || !threadId || existing.status !== "pending_review") return null;

    const decision = toHumanDecision(input, existing);
    await this.graph.invoke(new Command({ resume: decision }), {
      configurable: { thread_id: threadId },
    });

    const updated: ReengagementCase = {
      ...existing,
      status: input.action === "approve" ? "approved" : "rejected",
      ...(decision.type === "edit" && input.email ? { editedEmail: input.email } : {}),
      ...(input.action === "approve" && input.angleLabel
        ? { approvedAngleLabel: input.angleLabel }
        : {}),
    };
    this.cases.set(caseId, updated);
    return updated;
  }

  list(): ReengagementCase[] {
    return [...this.cases.values()];
  }

  get(caseId: string): ReengagementCase | null {
    return this.cases.get(caseId) ?? null;
  }

  has(caseId: string): boolean {
    return this.cases.has(caseId);
  }

  reset(): void {
    this.cases.clear();
    this.threads.clear();
    // Fresh graph → fresh MemorySaver, so interrupted threads don't pile up
    // across demo resets.
    this.graph = buildGraph(this.deps);
  }
}

function toHumanDecision(input: DecisionInput, existing: ReengagementCase): HumanDecision {
  if (input.action === "reject") return { type: "reject" };
  const original = existing.plan?.emailDraft;
  const edited =
    input.email &&
    original &&
    (input.email.subject !== original.subject || input.email.body !== original.body);
  if (edited && input.email) {
    return {
      type: "edit",
      draft: { ...input.email, rationale: "Edited by the rep before sending." },
    };
  }
  return { type: "approve" };
}

// Anchored on globalThis for the same reason as the other demo stores: dev
// recompiles must not wipe in-flight runs between route handlers and RSC.
const store = globalThis as typeof globalThis & { __relayBridge?: PipelineBridge };

export function getPipelineBridge(): PipelineBridge {
  store.__relayBridge ??= new PipelineBridge();
  return store.__relayBridge;
}
