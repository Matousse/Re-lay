import { beforeEach, describe, expect, it } from "vitest";
import { FakeCrm } from "@/integrations/crm/fake";
import type {
  CreateAgentInput,
  SillageAgent,
  SillagePersona,
  SillageWriteClient,
  UpdateAgentInput,
} from "@/integrations/signals/sillage-write";
import { resetConnectors } from "@/integrations/connectors";
import { getConnectorStates } from "@/services/connectors";
import { derivePersona, listClosedLostForSync, runSillageSync } from "@/services/sillage-sync";
import type { ClosedLostAccount } from "@/types/pipeline";
import type { SillageSyncEvent } from "@/types/sillage-sync";

// Records every write so a test can assert what the deterministic service sent,
// and lets each test seed the persona / agents Sillage already has.
class FakeSillage implements SillageWriteClient {
  addedDomains: string[] = [];
  personaPut: SillagePersona | null = null;
  created: CreateAgentInput[] = [];
  updated: { id: number; patch: UpdateAgentInput }[] = [];
  runs: { agentId: number; lookback?: number }[] = [];
  private nextId = 100;

  constructor(private seed: { persona?: SillagePersona | null; agents?: SillageAgent[] } = {}) {}

  async addTargetAccounts(domains: string[]) {
    this.addedDomains = domains;
    return { resolved: domains.length, notFound: [] };
  }
  async countTargetAccounts() {
    return this.addedDomains.length;
  }
  async getPersona() {
    return this.seed.persona ?? null;
  }
  async setPersona(persona: SillagePersona) {
    this.personaPut = persona;
  }
  async listAgents() {
    return this.seed.agents ?? [];
  }
  async createAgent(input: CreateAgentInput): Promise<SillageAgent> {
    this.created.push(input);
    return { id: this.nextId++, type: input.type, name: input.name, enabled: true };
  }
  async updateAgent(id: number, patch: UpdateAgentInput) {
    this.updated.push({ id, patch });
  }
  async launchSignalRun(agentId: number, params: { lookback_days?: number } = {}) {
    this.runs.push({ agentId, lookback: params.lookback_days });
    return [agentId * 10];
  }
  async runAllAgents() {
    const agents = await this.listAgents();
    for (const agent of agents) await this.launchSignalRun(agent.id);
    return { agents: agents.length, runs: agents.length };
  }
}

const ACCOUNTS: ClosedLostAccount[] = [
  {
    id: "a",
    company: "A",
    domain: "a.com",
    amount: null,
    lossReason: null,
    contacts: [
      { name: "X", jobTitle: "CMO", location: "Paris" },
      { name: "Y", jobTitle: "VP Sales", location: "Paris" },
    ],
  },
  {
    id: "b",
    company: "B",
    domain: "b.com",
    amount: null,
    lossReason: null,
    contacts: [{ name: "Z", jobTitle: "CMO", location: "Lyon" }],
  },
];

beforeEach(async () => {
  await resetConnectors();
});

describe("derivePersona", () => {
  it("uniquifies the contacts' titles and locations", () => {
    const persona = derivePersona(ACCOUNTS);
    expect(persona.job_title).toEqual(["CMO", "VP Sales"]);
    expect(persona.location).toEqual(["Paris", "Lyon"]);
    expect(persona.additional_info).toContain("2 comptes");
  });
});

describe("listClosedLostForSync", () => {
  it("pairs the CRM's closed-lost accounts with a derived persona", async () => {
    const data = await listClosedLostForSync({ crm: new FakeCrm() });
    expect(data.accounts.length).toBeGreaterThan(0);
    expect(data.persona.job_title.length).toBeGreaterThan(0);
  });
});

describe("runSillageSync", () => {
  const persona = { job_title: ["CMO"], location: ["Paris"], additional_info: "ICP" };

  it("runs the whole procedure in order and only connects on success", async () => {
    const sillage = new FakeSillage({
      persona: { headcount: ["51-200"], job_title: ["obsolete"] },
      agents: [
        { id: 1, type: "job_update", enabled: true },
        {
          id: 3,
          type: "keyword_detection",
          enabled: false,
          parameters: { tracking_keywords: ["seed"] },
        },
      ],
    });
    const events: SillageSyncEvent[] = [];

    const summary = await runSillageSync({
      domains: ["a.com", "b.com"],
      persona,
      deps: { sillage },
      onEvent: (event) => events.push(event),
    });

    // Accounts pushed as-is.
    expect(sillage.addedDomains).toEqual(["a.com", "b.com"]);

    // Persona is replace-whole: derived fields overwritten, headcount preserved.
    expect(sillage.personaPut).toEqual({
      headcount: ["51-200"],
      job_title: ["CMO"],
      location: ["Paris"],
      additional_info: "ICP",
    });

    // Agents reconciled by type: job_update untouched, keyword_detection
    // re-enabled, job_posting_keyword_detection created.
    expect(sillage.created.map((agent) => agent.type)).toEqual(["job_posting_keyword_detection"]);
    expect(sillage.updated).toEqual([{ id: 3, patch: { enabled: true } }]);
    expect(summary.agents).toEqual([
      { type: "job_update", action: "unchanged", id: 1 },
      { type: "job_posting_keyword_detection", action: "created", id: 100 },
      { type: "keyword_detection", action: "activated", id: 3 },
    ]);

    // A run per agent; keyword agents carry the lookback, job_update doesn't.
    expect(sillage.runs).toEqual([
      { agentId: 1, lookback: undefined },
      { agentId: 100, lookback: 90 },
      { agentId: 3, lookback: 90 },
    ]);

    // Connector flips only after every write landed.
    expect((await getConnectorStates()).sillage).toBe(true);

    // One start + end per step, in order.
    expect(events.filter((e) => e.type === "step_start").map((e) => e.step)).toEqual([
      "accounts",
      "persona",
      "agents",
      "runs",
    ]);
    expect(events.filter((e) => e.type === "step_end").every((e) => e.ok)).toBe(true);
  });

  it("creates all three agents on an empty workspace", async () => {
    const sillage = new FakeSillage();
    const summary = await runSillageSync({ domains: ["a.com"], persona, deps: { sillage } });
    expect(summary.agents.map((agent) => agent.action)).toEqual(["created", "created", "created"]);
    expect(sillage.created).toHaveLength(3);
  });

  it("emits a failed step and leaves Sillage disconnected when a write throws", async () => {
    const sillage = new FakeSillage();
    sillage.addTargetAccounts = async () => {
      throw new Error("402: Out of credits");
    };
    const events: SillageSyncEvent[] = [];

    await expect(
      runSillageSync({
        domains: ["a.com"],
        persona,
        deps: { sillage },
        onEvent: (e) => events.push(e),
      }),
    ).rejects.toThrow(/Out of credits/);

    expect(events).toContainEqual({
      type: "step_end",
      step: "accounts",
      ok: false,
      detail: "402: Out of credits",
    });
    expect((await getConnectorStates()).sillage).toBe(false);
  });
});
