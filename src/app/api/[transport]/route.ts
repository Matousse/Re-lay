import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
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

// Re:lay exposed over the Model Context Protocol (Streamable HTTP): a third
// entry point over the same services/ layer as the HTTP routes and RSCs, so
// any MCP client (Claude, a sales-ops agent…) can drive the product — list
// revivable deals, run the pipeline up to human review, route a decision.
// Tool handlers stay as thin as route handlers: validate, call a service,
// serialize.

function ok(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
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

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "connect_integrations",
      {
        title: "Connect integrations",
        description:
          "Connect every missing integration (signal engine, CRM, enrichment) so the pipeline can produce cases. Demo workspace setup — safe to call repeatedly.",
        inputSchema: {},
        annotations: { idempotentHint: true, openWorldHint: false },
      },
      async () => {
        const missing = await missingConnectors();
        for (const { id } of missing) await connectConnector(id);
        return ok({
          connected: missing.map((m) => m.name),
          message: missing.length === 0 ? "Everything was already connected." : "Pipeline online.",
        });
      },
    );

    server.registerTool(
      "list_signals",
      {
        title: "List signals",
        description:
          "Buying signals detected on closed-lost accounts (job changes, funding, site revisits…). Use a signal id with run_reengagement.",
        inputSchema: {},
        annotations: { readOnlyHint: true },
      },
      async () => ok(await getPipelineBridge().listSignals()),
    );

    server.registerTool(
      "list_revivable_deals",
      {
        title: "List revivable deals",
        description:
          "Pipeline stats plus every re-engagement case, sorted by status then score. Use get_case for the full record.",
        inputSchema: {},
        annotations: { readOnlyHint: true },
      },
      async () => {
        const offline = await offlineMessage();
        if (offline) return fail(offline);
        const [stats, cases] = await Promise.all([getStats(), listCases()]);
        return ok({ stats, cases: cases.map(summarize) });
      },
    );

    server.registerTool(
      "get_case",
      {
        title: "Get case",
        description:
          "Full re-engagement case: lost deal, signal, autopsy, scored go/no-go verdict, plan (target contact, angles, email draft) and decision state.",
        inputSchema: { caseId: z.string().describe("Case id from list_revivable_deals") },
        annotations: { readOnlyHint: true },
      },
      async ({ caseId }) => {
        const offline = await offlineMessage();
        if (offline) return fail(offline);
        const found = await getCase(caseId);
        return found ? ok(found) : fail(`No case "${caseId}".`);
      },
    );

    server.registerTool(
      "run_reengagement",
      {
        title: "Run re-engagement pipeline",
        description:
          "Run the Re:lay agent on a signal (autopsy → verdict → enrichment → plan). Deliberately stops at the human-review gate and returns the proposed play as a pending_review case — nothing is sent or written to the CRM.",
        inputSchema: { signalId: z.string().describe("Signal id from list_signals") },
      },
      async ({ signalId }) => {
        const result = await runPipelineForSignal(signalId);
        if (!result.ok) {
          return fail(
            result.reason === "offline"
              ? ((await offlineMessage()) ?? "The pipeline is offline.")
              : `Signal "${signalId}" is unknown, or the matched account has nothing to revive.`,
          );
        }
        return ok(result.case);
      },
    );

    server.registerTool(
      "approve_play",
      {
        title: "Approve play",
        description:
          "CONSEQUENTIAL — approving syncs the CRM (contact upserted, note logged, deal stage → Re-engaged) and announces the play on Slack. Only call after a human has explicitly reviewed and approved this specific case. Optionally pick an angle by label and/or override the email (subject and body together).",
        inputSchema: {
          caseId: z.string().describe("Case id in pending_review"),
          angleLabel: z.string().optional().describe("Angle label from the case's angleLabels"),
          subject: z.string().min(1).optional().describe("Edited email subject (requires body)"),
          body: z.string().min(1).optional().describe("Edited email body (requires subject)"),
        },
        annotations: { idempotentHint: false, openWorldHint: true },
      },
      async ({ caseId, angleLabel, subject, body }) => {
        if ((subject === undefined) !== (body === undefined)) {
          return fail("Provide subject and body together, or neither.");
        }
        const outcome = await decideCase(caseId, {
          action: "approve",
          email: subject !== undefined && body !== undefined ? { subject, body } : undefined,
          angleLabel,
        });
        if (!outcome) return fail(`No case "${caseId}" awaiting review.`);
        return ok({ case: summarize(outcome.case), effects: outcome.effects });
      },
    );

    server.registerTool(
      "reject_play",
      {
        title: "Reject play",
        description:
          "Reject a pending_review case — the play is closed and nothing is sent or synced.",
        inputSchema: { caseId: z.string().describe("Case id in pending_review") },
        annotations: { idempotentHint: false, openWorldHint: false },
      },
      async ({ caseId }) => {
        const outcome = await decideCase(caseId, { action: "reject" });
        if (!outcome) return fail(`No case "${caseId}" awaiting review.`);
        return ok({ case: summarize(outcome.case) });
      },
    );
  },
  {
    serverInfo: { name: "relay", version: "1.0.0" },
    capabilities: { tools: {} },
  },
  {
    basePath: "/api",
    maxDuration: 60,
  },
);

export { handler as GET, handler as POST, handler as DELETE };
