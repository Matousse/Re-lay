import axios, { type AxiosInstance } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeSillageWriteClient, SillageRestClient } from "@/integrations/signals/sillage-write";

afterEach(() => {
  vi.restoreAllMocks();
});

// Stands in for the injected AxiosInstance: each method resolves { data } the way
// axios does, routed by url so a test can script a specific endpoint's response.
type Responder = (url: string, body?: unknown) => Promise<{ data: unknown }>;
function fakeHttp(handlers: { get?: Responder; post?: Responder; put?: Responder }) {
  const notWired: Responder = async (url) => {
    throw new Error(`unexpected call ${url}`);
  };
  return {
    get: vi.fn(handlers.get ?? notWired),
    post: vi.fn(handlers.post ?? notWired),
    put: vi.fn(handlers.put ?? notWired),
    interceptors: { response: { use: vi.fn() } },
  } as unknown as AxiosInstance;
}

const fast = { pollIntervalMs: 0, maxPollAttempts: 5 };

describe("SillageRestClient", () => {
  it("adds accounts, polls ingestion to completion, and reports not-found domains", async () => {
    let statusCalls = 0;
    const http = fakeHttp({
      post: async () => ({ data: {} }),
      get: async (url) => {
        if (url.includes("/status")) {
          statusCalls += 1;
          return { data: { state: statusCalls === 1 ? "processing" : "completed" } };
        }
        if (url.includes("/not-found")) return { data: [{ user_input: "ghost.com" }] };
        throw new Error(`unexpected ${url}`);
      },
    });
    const client = new SillageRestClient("sk_live_x", http, fast);

    const result = await client.addTargetAccounts(["acme.com", "ghost.com"]);

    expect(result).toEqual({ resolved: 1, notFound: ["ghost.com"] });
    expect(statusCalls).toBe(2); // polled past the "processing" tick
  });

  it("returns null for an unset persona and the object when set", async () => {
    const unset = new SillageRestClient("k", fakeHttp({ get: async () => ({ data: null }) }), fast);
    expect(await unset.getPersona()).toBeNull();

    const set = new SillageRestClient(
      "k",
      fakeHttp({ get: async () => ({ data: { job_title: ["CMO"] } }) }),
      fast,
    );
    expect(await set.getPersona()).toEqual({ job_title: ["CMO"] });
  });

  it("PUTs the persona body verbatim", async () => {
    const put = vi.fn(async () => ({ data: {} }));
    const http = fakeHttp({ put });
    const client = new SillageRestClient("k", http, fast);

    await client.setPersona({ job_title: ["VP Sales"], location: ["France"] });

    expect(put).toHaveBeenCalledWith("/v2/persona", {
      job_title: ["VP Sales"],
      location: ["France"],
    });
  });

  it("lists agents, keeping only the fields the reconcile step reads", async () => {
    const http = fakeHttp({
      get: async () => ({
        data: [
          { id: 1, type: "job_update", name: "Moves", enabled: true, extra: "ignored" },
          {
            id: 2,
            type: "keyword_detection",
            enabled: false,
            parameters: { tracking_keywords: ["seed"] },
          },
        ],
      }),
    });
    const client = new SillageRestClient("k", http, fast);

    const agents = await client.listAgents();

    expect(agents).toHaveLength(2);
    expect(agents[0]).toMatchObject({ id: 1, type: "job_update", enabled: true });
    expect(agents[1].parameters?.tracking_keywords).toEqual(["seed"]);
  });

  it("launches a signal run and passes lookback_days only when given", async () => {
    const post = vi.fn(async () => ({ data: [{ signal_request_id: 42, stage: "running" }] }));
    const client = new SillageRestClient("k", fakeHttp({ post }), fast);

    expect(await client.launchSignalRun(7, { lookback_days: 90 })).toEqual([42]);
    expect(post).toHaveBeenCalledWith("/v2/workspace/signal-runs", {
      agent_id: 7,
      parameters: { lookback_days: 90 },
    });

    await client.launchSignalRun(8);
    expect(post).toHaveBeenLastCalledWith("/v2/workspace/signal-runs", { agent_id: 8 });
  });

  it("runs a signal run per agent and polls each run to a terminal stage", async () => {
    const pollCounts = new Map<number, number>();
    const posted: number[] = [];
    const http = fakeHttp({
      post: async (_url, body) => {
        const agentId = (body as { agent_id: number }).agent_id;
        posted.push(agentId);
        return { data: [{ signal_request_id: agentId * 10, stage: "running" }] };
      },
      get: async (url) => {
        if (url.includes("/agents")) {
          return {
            data: [
              { id: 1, type: "job_update", enabled: true },
              { id: 2, type: "keyword_detection", enabled: true },
            ],
          };
        }
        const match = /signal-runs\/(\d+)/.exec(url);
        if (match) {
          const id = Number(match[1]);
          const seen = (pollCounts.get(id) ?? 0) + 1;
          pollCounts.set(id, seen);
          // Loop once through "running" before reporting completion.
          return { data: { stage: seen < 2 ? "running" : "completed" } };
        }
        throw new Error(`unexpected ${url}`);
      },
    });
    const client = new SillageRestClient("k", http, fast);

    const result = await client.runAllAgents();

    expect(result).toEqual({ agents: 2, runs: 2 });
    expect(posted).toEqual([1, 2]);
    expect(pollCounts.get(10)).toBe(2); // polled past the "running" tick
    expect(pollCounts.get(20)).toBe(2);
  });

  it("treats completed_partial as a successful run", async () => {
    const http = fakeHttp({
      post: async (_url, body) => ({
        data: [{ signal_request_id: (body as { agent_id: number }).agent_id }],
      }),
      get: async (url) => {
        if (url.includes("/agents"))
          return { data: [{ id: 5, type: "job_update", enabled: true }] };
        return { data: { stage: "completed_partial" } };
      },
    });
    const client = new SillageRestClient("k", http, fast);

    await expect(client.runAllAgents()).resolves.toEqual({ agents: 1, runs: 1 });
  });

  it("rejects when a signal run reports the failed stage", async () => {
    const http = fakeHttp({
      post: async (_url, body) => ({
        data: [{ signal_request_id: (body as { agent_id: number }).agent_id }],
      }),
      get: async (url) => {
        if (url.includes("/agents"))
          return { data: [{ id: 9, type: "job_update", enabled: true }] };
        return { data: { stage: "failed" } };
      },
    });
    const client = new SillageRestClient("k", http, fast);

    await expect(client.runAllAgents()).rejects.toThrow(/failed/i);
  });

  it("surfaces the RFC 9457 detail on a typed error", async () => {
    const http = axios.create({ baseURL: "https://api.getsillage.com/api" });
    http.defaults.adapter = async (config) => {
      const error = new axios.AxiosError("Request failed", "ERR_BAD_RESPONSE", config);
      error.response = {
        status: 402,
        data: { detail: "Out of credits" },
        statusText: "",
        headers: {},
        config,
      } as never;
      throw error;
    };
    const client = new SillageRestClient("k", http, fast);

    await expect(client.getPersona()).rejects.toThrow(/Out of credits/);
  });

  it("refuses every call when no key is set", async () => {
    const client = makeSillageWriteClient(undefined);
    await expect(client.listAgents()).rejects.toThrow(/SILLAGE_API_KEY/);
    await expect(client.runAllAgents()).rejects.toThrow(/SILLAGE_API_KEY/);
  });
});
