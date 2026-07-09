import type { AxiosInstance } from "axios";
import { z } from "zod";
import { sleep } from "@/lib/async";
import { attachSillageErrorInterceptor, sillageHttp } from "@/integrations/signals/http";
import { env } from "@/lib/env";

// The write half of the Sillage integration — the v2 REST surface the read
// adapter (sillage.ts, deliberately left on v1) never touches. It stands up a
// workspace: target accounts, persona, agents, signal runs. Every enqueuing
// write returns 202 and is polled to a terminal state; persona is replace-whole
// (the caller GET → merges → PUT); the target-account add merges, never wipes.
// It shares the read side's host, auth and error style via sillageHttp.
// Endpoints and rules come from the sillage-api skill.

const AGENTS_PAGE_SIZE = 25; // Sillage caps /agents lower than the usual 100.
const DEFAULT_POLL_INTERVAL_MS = 1500;
const DEFAULT_MAX_POLL_ATTEMPTS = 40;
// The first re-check after a not-yet-done poll. Most ingestions finish within a
// second or two, so we look again quickly before settling into the steady
// interval: a fast sync advances the UI at once, a slow one still gets the full
// budget.
const FIRST_POLL_INTERVAL_MS = 400;

// Persona is replace-whole and carries fields we don't set (headcount, industry,
// seniority…). We keep it open so GET → merge → PUT never drops what's already
// there. Only the fields Re:lay derives are named.
export type SillagePersona = {
  job_title?: string[];
  exclude_job_title?: string[];
  location?: string[];
  headcount?: string[];
  industry?: string[];
  seniority?: string[];
  additional_info?: string;
  [field: string]: unknown;
};

// Only the agent fields the reconcile step reads. Sillage strips the rest.
const AgentSchema = z.object({
  id: z.number(),
  type: z.string(),
  name: z.string().nullish(),
  enabled: z.boolean().default(true),
  parameters: z.object({ tracking_keywords: z.array(z.string()).nullish() }).nullish(),
});
export type SillageAgent = z.infer<typeof AgentSchema>;

export type CreateAgentInput = {
  name: string;
  type: string;
  parameters?: { tracking_keywords: string[] };
};
export type UpdateAgentInput = {
  enabled?: boolean;
  parameters?: { tracking_keywords: string[] };
};

export interface SillageWriteClient {
  addTargetAccounts(domains: string[]): Promise<{ resolved: number; notFound: string[] }>;
  getPersona(): Promise<SillagePersona | null>;
  setPersona(persona: SillagePersona): Promise<void>;
  listAgents(): Promise<SillageAgent[]>;
  createAgent(input: CreateAgentInput): Promise<SillageAgent>;
  updateAgent(id: number, patch: UpdateAgentInput): Promise<void>;
  launchSignalRun(agentId: number, params?: { lookback_days?: number }): Promise<number[]>;
}

type ClientOptions = { pollIntervalMs?: number; maxPollAttempts?: number };

export class SillageRestClient implements SillageWriteClient {
  private http: AxiosInstance;
  private pollIntervalMs: number;
  private maxPollAttempts: number;

  constructor(apiKey: string, http?: AxiosInstance, options: ClientOptions = {}) {
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.maxPollAttempts = options.maxPollAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS;
    // Default to the shared Sillage client; an injected instance (tests) still
    // gets the same readable, typed-detail errors.
    this.http = http ? attachSillageErrorInterceptor(http) : sillageHttp(apiKey);
  }

  async addTargetAccounts(domains: string[]): Promise<{ resolved: number; notFound: string[] }> {
    if (domains.length === 0) return { resolved: 0, notFound: [] };
    await this.http.post("/v2/top-account-list/accounts", {
      accounts: domains.map((domain) => ({ domain })),
    });
    await this.pollAccountIngestion();
    const notFound = await this.readNotFoundDomains();
    return { resolved: domains.length - notFound.length, notFound };
  }

  async getPersona(): Promise<SillagePersona | null> {
    const { data } = await this.http.get("/v2/persona");
    return unwrap<SillagePersona | null>(data) ?? null;
  }

  async setPersona(persona: SillagePersona): Promise<void> {
    await this.http.put("/v2/persona", persona);
  }

  async listAgents(): Promise<SillageAgent[]> {
    const { data } = await this.http.get("/v2/agents", { params: { page_size: AGENTS_PAGE_SIZE } });
    const rows = unwrap<unknown[]>(data) ?? [];
    return rows.map((row) => AgentSchema.parse(row));
  }

  async createAgent(input: CreateAgentInput): Promise<SillageAgent> {
    const { data } = await this.http.post("/v2/agents", input);
    return AgentSchema.parse(unwrap(data));
  }

  async updateAgent(id: number, patch: UpdateAgentInput): Promise<void> {
    await this.http.put(`/v2/agents/${id}`, patch);
  }

  async launchSignalRun(
    agentId: number,
    params: { lookback_days?: number } = {},
  ): Promise<number[]> {
    const body =
      params.lookback_days != null
        ? { agent_id: agentId, parameters: { lookback_days: params.lookback_days } }
        : { agent_id: agentId };
    const { data } = await this.http.post("/v2/workspace/signal-runs", body);
    const runs = unwrap<Array<{ signal_request_id?: number }>>(data) ?? [];
    return runs
      .map((run) => run.signal_request_id)
      .filter((id): id is number => typeof id === "number");
  }

  private async pollAccountIngestion(): Promise<void> {
    await this.poll("target-account ingestion", async () => {
      const { data } = await this.http.get("/v2/top-account-list/status");
      const state = unwrap<{ state?: string }>(data)?.state;
      return { done: state === "completed" || state === "failed", failed: state === "failed" };
    });
  }

  private async readNotFoundDomains(): Promise<string[]> {
    const { data } = await this.http.get("/v2/top-account-list/accounts/not-found");
    const rows = unwrap<Array<{ user_input?: string }>>(data) ?? [];
    return rows.map((row) => row.user_input).filter((input): input is string => Boolean(input));
  }

  // Sillage emits no webhooks: poll the status endpoint politely to a terminal
  // state. Hitting the ceiling isn't fatal — a slow ingestion just reads as
  // "still processing" rather than failing the whole sync.
  private async poll(
    label: string,
    check: () => Promise<{ done: boolean; failed: boolean }>,
  ): Promise<void> {
    for (let attempt = 0; attempt < this.maxPollAttempts; attempt++) {
      const { done, failed } = await check();
      if (failed) throw new Error(`Sillage ${label} failed.`);
      if (done) return;
      const delayMs =
        attempt === 0 ? Math.min(FIRST_POLL_INTERVAL_MS, this.pollIntervalMs) : this.pollIntervalMs;
      await sleep(delayMs);
    }
  }
}

// Single- and list-envelope responses both wrap the payload in `data`; a bare
// object (e.g. the status body) is returned untouched. `{ data: null }` (unset
// persona) must yield null, so we test for the key rather than truthiness.
function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && !Array.isArray(payload) && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

const OFFLINE_MESSAGE =
  "Sillage isn't connected — set SILLAGE_API_KEY (sk_live_…) to run the sync.";

// No key → every call refuses with the same actionable message, which the sync
// route turns into an `error` event. Mirrors makeSignalSource's OFFLINE_SOURCE.
function offlineClient(): SillageWriteClient {
  const unavailable = async (): Promise<never> => {
    throw new Error(OFFLINE_MESSAGE);
  };
  return {
    addTargetAccounts: unavailable,
    getPersona: unavailable,
    setPersona: unavailable,
    listAgents: unavailable,
    createAgent: unavailable,
    updateAgent: unavailable,
    launchSignalRun: unavailable,
  };
}

export function makeSillageWriteClient(
  apiKey: string | undefined = env.SILLAGE_API_KEY,
): SillageWriteClient {
  return apiKey ? new SillageRestClient(apiKey) : offlineClient();
}
