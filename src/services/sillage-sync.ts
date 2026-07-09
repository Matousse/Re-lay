import { makeCrm } from "@/integrations/crm/factory";
import {
  makeSillageWriteClient,
  type SillageAgent,
  type SillagePersona,
  type SillageWriteClient,
} from "@/integrations/signals/sillage-write";
import { connectConnector } from "@/services/connectors";
import type { CrmPort } from "@/integrations/crm/port";
import type { ClosedLostAccount } from "@/types/pipeline";
import {
  DerivedPersonaSchema,
  type AgentAction,
  type ClosedLostSyncData,
  type DerivedPersona,
  type SillageSyncEvent,
  type SyncStep,
  type SyncSummary,
} from "@/types/sillage-sync";

// The Sillage reconciliation procedure from skills/SKILL.md, implemented as a
// deterministic service (no LLM): pull closed-lost accounts, add them as target
// accounts, set the persona, reconcile the three agents create-or-activate, then
// launch a run per agent. Each step emits a progress event so the connect modal
// animates the work live. Idempotent — safe to re-run after every CRM sync.

// The only three agent types Re:lay's read adapter maps onto a Signal. Order
// matters: keyword_detection needs a persona first, and persona is set before
// this step runs, so the fixed order below is always safe.
type AgentTarget = { type: string; name: string; keywords?: string[] };

// Funding / intent keywords for keyword_detection — bilingual, chosen to overlap
// FUNDING_PATTERN in sillage.ts so the detections survive the read adapter.
const FUNDING_KEYWORDS = [
  "levée de fonds",
  "tour de table",
  "Series A",
  "Series B",
  "Series C",
  "seed",
  "pre-seed",
  "amorçage",
  "fundraising",
  "financement",
  "raised",
  "funding round",
];

// GTM role titles for job_posting_keyword_detection — a hiring surge on these is
// the buying signal.
const GTM_ROLES = [
  "Revenue Operations",
  "RevOps",
  "Head of Sales",
  "VP Sales",
  "Chief Revenue Officer",
  "Directeur Commercial",
  "Head of Marketing",
  "CMO",
  "Demand Generation",
  "Sales Enablement",
];

const AGENT_TARGETS: AgentTarget[] = [
  { type: "job_update", name: "Re:lay – Mouvements décideurs" },
  { type: "job_posting_keyword_detection", name: "Re:lay – Recrutements GTM", keywords: GTM_ROLES },
  { type: "keyword_detection", name: "Re:lay – Signaux de levée", keywords: FUNDING_KEYWORDS },
];

const KEYWORD_LOOKBACK_DAYS = 90;

// Sillage blocks the workspace (and 422s the keyword agent) unless the persona
// carries at least one job_title and one location. When the CRM's contacts yield
// none, fall back to these so the persona is never empty — the user reviews and
// edits them in the modal before the sync runs.
const DEFAULT_PERSONA_TITLES = ["CMO", "VP Sales", "Head of Sales", "Revenue Operations"];
const DEFAULT_PERSONA_LOCATIONS = ["France"];

const STEP_LABELS: Record<SyncStep, string> = {
  accounts: "Pushing closed-lost accounts to Sillage",
  persona: "Setting the workspace persona",
  agents: "Reconciling the three agents",
  runs: "Launching a signal run per agent",
};

type SyncDeps = { crm?: CrmPort; sillage?: SillageWriteClient };

export async function listClosedLostForSync(
  deps: Pick<SyncDeps, "crm"> = {},
): Promise<ClosedLostSyncData> {
  const crm = deps.crm ?? makeCrm();
  const accounts = await crm.listClosedLostAccounts();
  return { accounts, persona: derivePersona(accounts) };
}

// job_title[] / location[] are what Sillage minimally needs; additional_info
// records where the ICP came from. Empty axes fall back to defaults so the
// persona never blocks the workspace.
export function derivePersona(accounts: ClosedLostAccount[]): DerivedPersona {
  const contacts = accounts.flatMap((account) => account.contacts);
  const jobTitles = unique(contacts.map((contact) => contact.jobTitle));
  const locations = unique(contacts.map((contact) => contact.location));
  return DerivedPersonaSchema.parse({
    job_title: jobTitles.length ? jobTitles : DEFAULT_PERSONA_TITLES,
    location: locations.length ? locations : DEFAULT_PERSONA_LOCATIONS,
    additional_info: `ICP dérivé de ${accounts.length} comptes perdus (${contacts.length} contacts) — décideurs GTM à recibler pour la reconquête.`,
  });
}

export async function runSillageSync(input: {
  domains: string[];
  persona: DerivedPersona;
  onEvent?: (event: SillageSyncEvent) => void;
  deps?: SyncDeps;
}): Promise<SyncSummary> {
  const emit = safeEmit(input.onEvent);
  const sillage = input.deps?.sillage ?? makeSillageWriteClient();

  const accounts = await runStep(emit, "accounts", () => addAccounts(sillage, input.domains));
  await runStep(emit, "persona", () => setPersona(sillage, input.persona));
  const agents = await runStep(emit, "agents", () => reconcileAgents(sillage));
  const runs = await runStep(emit, "runs", () => launchRuns(sillage, agents));

  // Only flip the connector once every write landed — a partial sync leaves
  // Sillage "not connected" so the user can retry.
  await connectConnector("sillage");

  return {
    accounts,
    persona: {
      jobTitles: input.persona.job_title.length,
      locations: input.persona.location.length,
    },
    agents,
    runs,
  };
}

async function addAccounts(
  sillage: SillageWriteClient,
  domains: string[],
): Promise<StepResult<SyncSummary["accounts"]>> {
  const { resolved, notFound } = await sillage.addTargetAccounts(domains);
  const value = { added: domains.length, resolved, notFound };
  const detail = notFound.length
    ? `${resolved} resolved · ${notFound.length} not found (${notFound.join(", ")})`
    : `${resolved} account${resolved === 1 ? "" : "s"} resolved`;
  return { value, detail };
}

// Persona is replace-whole: GET the full object, overwrite only the derived
// fields, PUT it back — never dropping headcount/industry/seniority if set.
async function setPersona(
  sillage: SillageWriteClient,
  persona: DerivedPersona,
): Promise<StepResult<null>> {
  // Fail here, not on the agents step: Sillage refuses the keyword agent when the
  // persona is empty, so surface the real cause where it happens.
  if (persona.job_title.length === 0 || persona.location.length === 0) {
    throw new Error("The persona needs at least one job title and one location.");
  }
  const existing = (await sillage.getPersona()) ?? {};
  const merged: SillagePersona = {
    ...existing,
    job_title: persona.job_title,
    location: persona.location,
    additional_info: persona.additional_info,
  };
  await sillage.setPersona(merged);
  return {
    value: null,
    detail: `${persona.job_title.length} titles · ${persona.location.length} locations`,
  };
}

async function reconcileAgents(
  sillage: SillageWriteClient,
): Promise<StepResult<SyncSummary["agents"]>> {
  const existing = await sillage.listAgents();
  const agents: SyncSummary["agents"] = [];
  for (const target of AGENT_TARGETS) {
    agents.push(await reconcileAgent(sillage, existing, target));
  }
  return { value: agents, detail: describeAgents(agents) };
}

// Match on type, not name — one agent per type is the invariant. Never
// delete-and-recreate: a new POST would mint a new id and orphan its data.
async function reconcileAgent(
  sillage: SillageWriteClient,
  existing: SillageAgent[],
  target: AgentTarget,
): Promise<{ type: string; action: AgentAction; id: number }> {
  const found = existing.find((agent) => agent.type === target.type);
  if (!found) {
    const created = await sillage.createAgent({
      name: target.name,
      type: target.type,
      ...(target.keywords ? { parameters: { tracking_keywords: target.keywords } } : {}),
    });
    return { type: target.type, action: "created", id: created.id };
  }
  if (target.keywords && !hasKeywords(found)) {
    await sillage.updateAgent(found.id, {
      parameters: { tracking_keywords: target.keywords },
      ...(found.enabled ? {} : { enabled: true }),
    });
    return { type: target.type, action: "reconfigured", id: found.id };
  }
  if (!found.enabled) {
    await sillage.updateAgent(found.id, { enabled: true });
    return { type: target.type, action: "activated", id: found.id };
  }
  return { type: target.type, action: "unchanged", id: found.id };
}

async function launchRuns(
  sillage: SillageWriteClient,
  agents: SyncSummary["agents"],
): Promise<StepResult<SyncSummary["runs"]>> {
  const runs: SyncSummary["runs"] = [];
  for (const agent of agents) {
    const isKeywordAgent = agent.type !== "job_update";
    const signalRequestIds = await sillage.launchSignalRun(
      agent.id,
      isKeywordAgent ? { lookback_days: KEYWORD_LOOKBACK_DAYS } : {},
    );
    runs.push({ agentId: agent.id, signalRequestIds });
  }
  const launched = runs.reduce((sum, run) => sum + run.signalRequestIds.length, 0);
  return { value: runs, detail: `${launched} run${launched === 1 ? "" : "s"} launched` };
}

type StepResult<T> = { value: T; detail: string };

// Emits step_start, runs the step, then step_end (ok on success, failure detail
// on throw) before rethrowing so the modal marks exactly the failing step.
async function runStep<T>(
  emit: (event: SillageSyncEvent) => void,
  step: SyncStep,
  run: () => Promise<StepResult<T>>,
): Promise<T> {
  emit({ type: "step_start", step, label: STEP_LABELS[step] });
  try {
    const { value, detail } = await run();
    emit({ type: "step_end", step, ok: true, detail });
    return value;
  } catch (error) {
    emit({ type: "step_end", step, ok: false, detail: errorMessage(error) });
    throw error;
  }
}

function hasKeywords(agent: SillageAgent): boolean {
  return (agent.parameters?.tracking_keywords?.length ?? 0) > 0;
}

function describeAgents(agents: SyncSummary["agents"]): string {
  const counts = new Map<AgentAction, number>();
  for (const agent of agents) counts.set(agent.action, (counts.get(agent.action) ?? 0) + 1);
  return [...counts.entries()].map(([action, count]) => `${count} ${action}`).join(" · ");
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function safeEmit(onEvent?: (event: SillageSyncEvent) => void) {
  return (event: SillageSyncEvent) => {
    try {
      onEvent?.(event);
    } catch {
      // A broken listener must never break the sync.
    }
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error.";
}
