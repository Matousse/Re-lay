import { z } from "zod";
import { formatCurrency } from "@/lib/format";
import { connectConnector, missingConnectors } from "@/services/connectors";
import { getPipelineBridge } from "@/services/pipeline-bridge";
import {
  decideCase,
  getCase,
  getStats,
  listCases,
  runPipelineForSignal,
} from "@/services/reengagement";
import type { ReengagementCase } from "@/types/reengagement";

// The single tool surface Re:lay exposes to agents. Both entry points consume
// this registry — the MCP server (app/api/[transport]) for external agents and
// the in-app assistant (services/assistant.ts) for the chat bubble — so a tool
// added here ships everywhere at once. Handlers validate their args with the
// tool's own schema (the domain boundary), call a service, and return plain
// text for the model.

// `text` is the full payload handed to the model; `summary` is one
// human-readable line of what happened, surfaced in the chat's step bubbles.
export type RelayToolResult = { text: string; isError?: boolean; summary?: string };

export type RelayTool = {
  name: string;
  title: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  annotations?: { readOnlyHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
  handler: (args: Record<string, unknown>) => Promise<RelayToolResult>;
};

function ok(payload: unknown, summary?: string): RelayToolResult {
  return { text: JSON.stringify(payload, null, 2), summary };
}

function fail(message: string): RelayToolResult {
  return { text: message, isError: true };
}

// Compact projection for list views — get_case returns the full record.
function summarize(c: ReengagementCase) {
  return {
    caseId: c.id,
    company: c.deal.company.name,
    industry: c.deal.company.industry,
    amountEur: c.deal.amount,
    lostAt: c.deal.lostAt,
    lossReason: c.deal.lossReason,
    status: c.status,
    verdict: c.verdict.decision,
    score: c.verdict.score,
    signal: { type: c.signal.type, title: c.signal.title },
    angleLabels: c.plan
      ? [c.plan.angleLabel, ...(c.plan.altAngles?.map((a) => a.label) ?? [])].filter(Boolean)
      : [],
  };
}

// The pipeline is gated on connectors exactly like the UI; surface the same
// state as an actionable message instead of a silent empty list.
async function offlineMessage(): Promise<string | null> {
  const missing = await missingConnectors();
  if (missing.length === 0) return null;
  const names = missing.map((m) => m.name).join(", ");
  return `The pipeline is offline — not connected: ${names}. Call connect_integrations first.`;
}

const GetCaseArgs = z.object({ caseId: z.string().describe("Case id from list_revivable_deals") });
const RunArgs = z.object({ signalId: z.string().describe("Signal id from list_signals") });
const ApproveArgs = z.object({
  caseId: z.string().describe("Case id in pending_review"),
  angleLabel: z.string().optional().describe("Angle label from the case's angleLabels"),
  subject: z.string().min(1).optional().describe("Edited email subject (requires body)"),
  body: z.string().min(1).optional().describe("Edited email body (requires subject)"),
});
const RejectArgs = z.object({ caseId: z.string().describe("Case id in pending_review") });

export const RELAY_TOOLS: RelayTool[] = [
  {
    name: "connect_integrations",
    title: "Connect integrations",
    description:
      "Connect every missing integration (signal engine, CRM, enrichment) so the pipeline can produce cases. Demo workspace setup — safe to call repeatedly.",
    schema: z.object({}),
    annotations: { idempotentHint: true, openWorldHint: false },
    handler: async () => {
      const missing = await missingConnectors();
      for (const { id } of missing) await connectConnector(id);
      const summary =
        missing.length === 0
          ? "Everything was already connected."
          : `Connected ${missing.map((m) => m.name).join(", ")} — pipeline online.`;
      return ok({ connected: missing.map((m) => m.name), message: summary }, summary);
    },
  },
  {
    name: "list_signals",
    title: "List signals",
    description:
      "Buying signals detected on closed-lost accounts (job changes, funding, site revisits…). Use a signal id with run_reengagement.",
    schema: z.object({}),
    annotations: { readOnlyHint: true },
    handler: async () => {
      const signals = await getPipelineBridge().listSignals();
      const companies = [...new Set(signals.map((s) => s.company))];
      const names =
        companies.length > 0
          ? ` (${companies.slice(0, 3).join(", ")}${companies.length > 3 ? "…" : ""})`
          : "";
      return ok(
        signals,
        `${signals.length} signal${signals.length === 1 ? "" : "s"} found across ${companies.length} compan${companies.length === 1 ? "y" : "ies"}${names}.`,
      );
    },
  },
  {
    name: "list_revivable_deals",
    title: "List revivable deals",
    description:
      "Pipeline stats plus every re-engagement case, sorted by status then score. Use get_case for the full record.",
    schema: z.object({}),
    annotations: { readOnlyHint: true },
    handler: async () => {
      const offline = await offlineMessage();
      if (offline) return fail(offline);
      const [stats, cases] = await Promise.all([getStats(), listCases()]);
      return ok(
        { stats, cases: cases.map(summarize) },
        `${stats.signalsMatched} cases · ${stats.goVerdicts} go verdicts · ${stats.pendingReview} pending review · ${formatCurrency(stats.revivablePipeline)} revivable.`,
      );
    },
  },
  {
    name: "get_case",
    title: "Get case",
    description:
      "Full re-engagement case: lost deal, signal, autopsy, scored go/no-go verdict, plan (target contact, angles, email draft) and decision state.",
    schema: GetCaseArgs,
    annotations: { readOnlyHint: true },
    handler: async (args) => {
      const parsed = GetCaseArgs.safeParse(args);
      if (!parsed.success) return fail("get_case needs a caseId (string).");
      const offline = await offlineMessage();
      if (offline) return fail(offline);
      const found = await getCase(parsed.data.caseId);
      if (!found) return fail(`No case "${parsed.data.caseId}".`);
      return ok(
        found,
        `${found.deal.company.name} — ${formatCurrency(found.deal.amount)} · ${found.verdict.decision.toUpperCase()} ${found.verdict.score}/100 · ${found.status.replace("_", " ")}.`,
      );
    },
  },
  {
    name: "run_reengagement",
    title: "Run re-engagement pipeline",
    description:
      "Run the Re:lay agent on a signal (autopsy → verdict → enrichment → plan). Deliberately stops at the human-review gate and returns the proposed play as a pending_review case — nothing is sent or written to the CRM.",
    schema: RunArgs,
    handler: async (args) => {
      const parsed = RunArgs.safeParse(args);
      if (!parsed.success) return fail("run_reengagement needs a signalId (string).");
      const result = await runPipelineForSignal(parsed.data.signalId);
      if (!result.ok) {
        return fail(
          result.reason === "offline"
            ? ((await offlineMessage()) ?? "The pipeline is offline.")
            : `Signal "${parsed.data.signalId}" is unknown, or the matched account has nothing to revive.`,
        );
      }
      const c = result.case;
      return ok(
        c,
        `Play proposed for ${c.deal.company.name} (${formatCurrency(c.deal.amount)}): ${c.verdict.decision.toUpperCase()} ${c.verdict.score}/100 — waiting for human review, nothing sent.`,
      );
    },
  },
  {
    name: "approve_play",
    title: "Approve play",
    description:
      "CONSEQUENTIAL — approving syncs the CRM (contact upserted, note logged, deal stage → Re-engaged) and announces the play on the team channels. Only call after a human has explicitly reviewed and approved this specific case. Optionally pick an angle by label and/or override the email (subject and body together).",
    schema: ApproveArgs,
    annotations: { idempotentHint: false, openWorldHint: true },
    handler: async (args) => {
      const parsed = ApproveArgs.safeParse(args);
      if (!parsed.success) return fail("approve_play needs a caseId (string).");
      const { caseId, angleLabel, subject, body } = parsed.data;
      if ((subject === undefined) !== (body === undefined)) {
        return fail("Provide subject and body together, or neither.");
      }
      const outcome = await decideCase(caseId, {
        action: "approve",
        email: subject !== undefined && body !== undefined ? { subject, body } : undefined,
        angleLabel,
      });
      if (!outcome) return fail(`No case "${caseId}" awaiting review.`);
      const effects = outcome.effects;
      const channels = [
        effects.crmSynced ? "CRM synced" : null,
        effects.slackNotified ? "Slack posted" : null,
        effects.emailNotified ? "owner emailed" : null,
      ].filter(Boolean);
      return ok(
        { case: summarize(outcome.case), effects },
        `${outcome.case.deal.company.name} approved${angleLabel ? ` via "${angleLabel}"` : ""} — ${channels.join(" · ") || "no downstream action"}.`,
      );
    },
  },
  {
    name: "reject_play",
    title: "Reject play",
    description: "Reject a pending_review case — the play is closed and nothing is sent or synced.",
    schema: RejectArgs,
    annotations: { idempotentHint: false, openWorldHint: false },
    handler: async (args) => {
      const parsed = RejectArgs.safeParse(args);
      if (!parsed.success) return fail("reject_play needs a caseId (string).");
      const outcome = await decideCase(parsed.data.caseId, { action: "reject" });
      if (!outcome) return fail(`No case "${parsed.data.caseId}" awaiting review.`);
      return ok(
        { case: summarize(outcome.case) },
        `${outcome.case.deal.company.name} rejected — play closed, nothing sent or synced.`,
      );
    },
  },
];
