import { z } from "zod";
import { getCompanyContext, readWebsite, saveCompanyContext } from "@/integrations/company-context";
import { saveNotificationRouting } from "@/integrations/notifications/routing";
import {
  isKeywordAgentType,
  KEYWORD_AGENT_TYPES,
  makeSillageSetup,
  SIMPLE_AGENT_TYPES,
} from "@/integrations/signals/sillage-setup";
import { normalizeDomain } from "@/lib/domain";
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
import {
  CompanyContextInputSchema,
  NotificationRoutingInputSchema,
  routingHasChannel,
} from "@/types/onboarding";
import type { ReengagementCase } from "@/types/reengagement";

// The single tool surface Re:lay exposes to agents. Both entry points consume
// this registry — the MCP server (app/api/[transport]) for external agents and
// the in-app assistant (services/assistant.ts) for the chat bubble — so a tool
// added here ships everywhere at once.
//
// Execution contract: callers go through runTool(), which validates the raw
// args against the tool's schema exactly once and never throws — handlers
// receive parsed, typed args and only contain the work itself.

// `text` is the full payload handed to the model; `summary` is one
// human-readable line of what happened, surfaced in the chat's step bubbles.
export type RelayToolResult = { text: string; isError?: boolean; summary?: string };

type ToolAnnotations = {
  readOnlyHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
};

export type RelayTool = {
  name: string;
  title: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  annotations?: ToolAnnotations;
  // Never call directly — runTool() validates first. The unknown cast is
  // sealed inside defineTool, where the schema and handler types are linked.
  execute: (parsedArgs: unknown) => Promise<RelayToolResult>;
};

// Links a schema to its handler's argument type once, at definition site.
export function defineTool<S extends z.ZodObject<z.ZodRawShape>>(tool: {
  name: string;
  title: string;
  description: string;
  schema: S;
  annotations?: ToolAnnotations;
  handler: (args: z.output<S>) => Promise<RelayToolResult>;
}): RelayTool {
  const { handler, ...rest } = tool;
  return { ...rest, execute: (parsedArgs) => handler(parsedArgs as z.output<S>) };
}

// The only entry point: validates, runs, and turns anything unexpected into
// an isError result — a failing tool must degrade into text the model can
// react to, never into an exception that kills the stream.
export async function runTool(tool: RelayTool, rawArgs: unknown): Promise<RelayToolResult> {
  const parsed = tool.schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue && issue.path.length > 0 ? issue.path.join(".") : "input";
    return fail(`${tool.name}: invalid arguments — ${where}: ${issue?.message ?? "invalid"}.`);
  }
  try {
    return await tool.execute(parsed.data);
  } catch (error) {
    return fail(`${tool.name} failed: ${(error as Error).message}`);
  }
}

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

const SILLAGE_KEY_MISSING = "Sillage is not connected — SILLAGE_API_KEY is missing.";

// ── Argument schemas (exposed to MCP/Anthropic AND used for validation) ─────

const EmptyArgs = z.object({});
const GetCaseArgs = z.object({ caseId: z.string().describe("Case id from list_revivable_deals") });
const RunArgs = z.object({ signalId: z.string().describe("Signal id from list_signals") });
const ApproveArgs = z.object({
  caseId: z.string().describe("Case id in pending_review"),
  angleLabel: z.string().optional().describe("Angle label from the case's angleLabels"),
  subject: z.string().min(1).optional().describe("Edited email subject (requires body)"),
  body: z.string().min(1).optional().describe("Edited email body (requires subject)"),
});
const RejectArgs = z.object({ caseId: z.string().describe("Case id in pending_review") });
const ReadWebsiteArgs = z.object({
  url: z.url().describe("Full URL, e.g. https://company.com"),
});
const PersonaArgs = z.object({
  jobTitles: z.array(z.string().min(1)).min(1).describe("Target job titles"),
  industries: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  additionalInfo: z.string().optional().describe("Free-text persona context"),
});
const CreateAgentArgs = z.object({
  name: z.string().min(1).max(100).describe("Display name of the agent"),
  type: z.enum([...KEYWORD_AGENT_TYPES, ...SIMPLE_AGENT_TYPES]),
  keywords: z
    .array(z.string().min(1))
    .optional()
    .describe("Required for keyword agent types; quote a keyword for exact-phrase matching"),
});
const WatchAccountsArgs = z.object({
  domains: z
    .array(z.string().min(3))
    .min(1)
    .describe('Company domains or URLs, e.g. ["qonto.com"]'),
});

// ── The tools ────────────────────────────────────────────────────────────────

export const RELAY_TOOLS: RelayTool[] = [
  defineTool({
    name: "connect_integrations",
    title: "Connect integrations",
    description:
      "Connect every missing integration (signal engine, CRM, enrichment) so the pipeline can produce cases. Demo workspace setup — safe to call repeatedly.",
    schema: EmptyArgs,
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
  }),

  defineTool({
    name: "list_signals",
    title: "List signals",
    description:
      "Buying signals detected on closed-lost accounts (job changes, funding, site revisits…). Use a signal id with run_reengagement.",
    schema: EmptyArgs,
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
  }),

  defineTool({
    name: "list_revivable_deals",
    title: "List revivable deals",
    description:
      "Pipeline stats plus every re-engagement case, sorted by status then score. Use get_case for the full record.",
    schema: EmptyArgs,
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
  }),

  defineTool({
    name: "get_case",
    title: "Get case",
    description:
      "Full re-engagement case: lost deal, signal, autopsy, scored go/no-go verdict, plan (target contact, angles, email draft) and decision state.",
    schema: GetCaseArgs,
    annotations: { readOnlyHint: true },
    handler: async ({ caseId }) => {
      const offline = await offlineMessage();
      if (offline) return fail(offline);
      const found = await getCase(caseId);
      if (!found) return fail(`No case "${caseId}".`);
      return ok(
        found,
        `${found.deal.company.name} — ${formatCurrency(found.deal.amount)} · ${found.verdict.decision.toUpperCase()} ${found.verdict.score}/100 · ${found.status.replace("_", " ")}.`,
      );
    },
  }),

  defineTool({
    name: "run_reengagement",
    title: "Run re-engagement pipeline",
    description:
      "Run the Re:lay agent on a signal (autopsy → verdict → enrichment → plan). Deliberately stops at the human-review gate and returns the proposed play as a pending_review case — nothing is sent or written to the CRM.",
    schema: RunArgs,
    handler: async ({ signalId }) => {
      const result = await runPipelineForSignal(signalId);
      if (!result.ok) {
        return fail(
          result.reason === "offline"
            ? ((await offlineMessage()) ?? "The pipeline is offline.")
            : `Signal "${signalId}" is unknown, or the matched account has nothing to revive.`,
        );
      }
      const c = result.case;
      return ok(
        c,
        `Play proposed for ${c.deal.company.name} (${formatCurrency(c.deal.amount)}): ${c.verdict.decision.toUpperCase()} ${c.verdict.score}/100 — waiting for human review, nothing sent.`,
      );
    },
  }),

  defineTool({
    name: "approve_play",
    title: "Approve play",
    description:
      "CONSEQUENTIAL — approving syncs the CRM (contact upserted, note logged, deal stage → Re-engaged) and announces the play on the team channels. Only call after a human has explicitly reviewed and approved this specific case. Optionally pick an angle by label and/or override the email (subject and body together).",
    schema: ApproveArgs,
    annotations: { idempotentHint: false, openWorldHint: true },
    handler: async ({ caseId, angleLabel, subject, body }) => {
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
  }),

  defineTool({
    name: "reject_play",
    title: "Reject play",
    description: "Reject a pending_review case — the play is closed and nothing is sent or synced.",
    schema: RejectArgs,
    annotations: { idempotentHint: false, openWorldHint: false },
    handler: async ({ caseId }) => {
      const outcome = await decideCase(caseId, { action: "reject" });
      if (!outcome) return fail(`No case "${caseId}" awaiting review.`);
      return ok(
        { case: summarize(outcome.case) },
        `${outcome.case.deal.company.name} rejected — play closed, nothing sent or synced.`,
      );
    },
  }),

  // ── Onboarding: teach Re:lay the company, configure Sillage, route plays ──

  defineTool({
    name: "get_workspace_setup",
    title: "Get workspace setup",
    description:
      "Where onboarding stands: Sillage setup state (persona, account list, ingestion), the signal agents running, and whether Re:lay knows the company context yet. Start here when helping someone set up.",
    schema: EmptyArgs,
    annotations: { readOnlyHint: true },
    handler: async () => {
      const setup = makeSillageSetup();
      if (!setup) return fail(SILLAGE_KEY_MISSING);
      const [state, agents, persona] = await Promise.all([
        setup.getSetupState(),
        setup.listAgents(),
        setup.getPersona(),
      ]);
      const context = getCompanyContext();
      return ok(
        { sillage: { state, persona, agents }, companyContext: context },
        `Persona ${state.persona_set ? "✓" : "✗"} · accounts ${state.list_uploaded ? "✓" : "✗"} · ${agents.length} agent${agents.length === 1 ? "" : "s"} · company context ${context ? "✓" : "✗"}.`,
      );
    },
  }),

  defineTool({
    name: "read_website",
    title: "Read a website",
    description:
      "Fetch a public company website and return its readable text so you can understand the offering, ICP and stakes — the first step of onboarding. Follow up with save_company_context once the human confirms your summary.",
    schema: ReadWebsiteArgs,
    annotations: { readOnlyHint: true, openWorldHint: true },
    handler: async ({ url }) => {
      const { text, truncated } = await readWebsite(url);
      if (!text) return fail("The page had no readable text.");
      return {
        text,
        summary: `Read ${text.length} chars from ${url}${truncated ? " (truncated)" : ""}.`,
      };
    },
  }),

  defineTool({
    name: "save_company_context",
    title: "Save company context",
    description:
      "Persist what Re:lay knows about the company it works for (offering, ICP, what's at stake). Used to sharpen every plan and email. Summarize from the website or the human's words, confirm with them, then save.",
    schema: CompanyContextInputSchema,
    handler: async (input) => {
      const saved = saveCompanyContext(input);
      return ok(saved, "Company context saved — Re:lay now knows the offering, ICP and stakes.");
    },
  }),

  defineTool({
    name: "configure_sillage_persona",
    title: "Configure the Sillage persona",
    description:
      "CONSEQUENTIAL — writes the workspace persona Sillage uses to detect the right people (job titles, industries, locations, free-text context). Configures the live, shared workspace: confirm the exact persona with the human before calling.",
    schema: PersonaArgs,
    annotations: { idempotentHint: true, openWorldHint: true },
    handler: async ({ jobTitles, industries, locations, additionalInfo }) => {
      const setup = makeSillageSetup();
      if (!setup) return fail(SILLAGE_KEY_MISSING);
      const { warnings } = await setup.updatePersona({
        job_title: jobTitles,
        industry: industries,
        location: locations,
        additional_info: additionalInfo,
      });
      return ok(
        { saved: true, warnings },
        `Sillage persona saved (${jobTitles.join(", ")})${warnings.length > 0 ? ` — warnings: ${warnings.join("; ")}` : ""}.`,
      );
    },
  }),

  defineTool({
    name: "create_signal_agent",
    title: "Create a Sillage signal agent",
    description: `CONSEQUENTIAL — creates a live detection agent in the shared Sillage workspace: confirm name, type and keywords with the human first. Keyword types (${KEYWORD_AGENT_TYPES.join(", ")}) require keywords; relationship types (${SIMPLE_AGENT_TYPES.join(", ")}) take none.`,
    schema: CreateAgentArgs,
    annotations: { idempotentHint: false, openWorldHint: true },
    handler: async ({ name, type, keywords }) => {
      if (isKeywordAgentType(type) && (keywords?.length ?? 0) === 0) {
        return fail(`Agent type "${type}" requires at least one keyword.`);
      }
      const setup = makeSillageSetup();
      if (!setup) return fail(SILLAGE_KEY_MISSING);
      const agent = await setup.createAgent({ name, type, keywords });
      return ok(
        agent,
        `Agent "${agent.name}" (${agent.type}) created — ${agent.enabled ? "running" : "not enabled yet"}.`,
      );
    },
  }),

  defineTool({
    name: "watch_accounts",
    title: "Watch accounts on Sillage",
    description:
      "CONSEQUENTIAL — adds companies (by domain) to the live workspace's monitored account list so Sillage detects signals on them. The natural move: watch every closed-lost account from the CRM. Confirm the list with the human first.",
    schema: WatchAccountsArgs,
    annotations: { idempotentHint: true, openWorldHint: true },
    handler: async ({ domains }) => {
      const normalized = domains.map((domain) => ({ raw: domain, clean: normalizeDomain(domain) }));
      const invalid = normalized.filter((d) => d.clean === null).map((d) => d.raw);
      if (invalid.length > 0) {
        return fail(`Not valid domains: ${invalid.join(", ")}. Use bare domains like "qonto.com".`);
      }
      const clean = [...new Set(normalized.map((d) => d.clean as string))];
      const setup = makeSillageSetup();
      if (!setup) return fail(SILLAGE_KEY_MISSING);
      const count = await setup.addAccounts(clean);
      return ok(
        { added: clean },
        `${count} account${count === 1 ? "" : "s"} added to the Sillage watch list (${clean.join(", ")}).`,
      );
    },
  }),

  defineTool({
    name: "route_notifications",
    title: "Route notifications to a person",
    description:
      "Assign who receives the plays: they get @-mentioned in the Slack announcements and become the email recipient. Ask for their name, and their Slack member ID (starts with U) and/or email.",
    schema: NotificationRoutingInputSchema,
    annotations: { idempotentHint: true, openWorldHint: false },
    handler: async (routing) => {
      if (!routingHasChannel(routing)) {
        return fail("Provide at least an email or a Slack member ID.");
      }
      const saved = saveNotificationRouting(routing);
      const channels = [
        saved.slackMemberId ? `Slack @${saved.name}` : null,
        saved.email ? saved.email : null,
      ].filter(Boolean);
      return ok(saved, `Plays now routed to ${saved.name} (${channels.join(" · ")}).`);
    },
  }),
];
