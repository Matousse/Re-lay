import type { AxiosInstance } from "axios";
import { z } from "zod";
import { sillageHttp } from "@/integrations/signals/http";
import { env } from "@/lib/env";

// Workspace-setup side of the Sillage public API: the persona (who to
// detect), the signal agents (what to detect) and the top-account list (whom
// to watch). Schemas mirror the live OpenAPI spec but only declare the fields
// we consume. This is what lets Re:lay onboard a workspace conversationally
// instead of sending humans into a settings maze.

const SetupStateSchema = z.object({
  persona_set: z.boolean(),
  list_uploaded: z.boolean(),
  ingestion_complete: z.boolean(),
  has_contents: z.boolean(),
});
export type SetupState = z.infer<typeof SetupStateSchema>;

const PersonaSchema = z.object({
  data: z
    .object({
      job_title: z.array(z.string()).nullish(),
      industry: z.array(z.string()).nullish(),
      location: z.array(z.string()).nullish(),
      additional_info: z.string().nullish(),
    })
    .nullish(),
});

export type PersonaInput = {
  job_title?: string[];
  industry?: string[];
  location?: string[];
  additional_info?: string;
};
const PersonaWriteSchema = z.object({
  data: z.object({ id: z.number() }),
  warnings: z.array(z.string()).optional(),
});

const AgentSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string(),
  enabled: z.boolean(),
});
const AgentListSchema = z.object({ data: z.array(AgentSchema) });
const AgentCreateSchema = z.object({ data: AgentSchema });
export type SillageAgent = z.infer<typeof AgentSchema>;

// Agent kinds the assistant may create: keyword-driven ones need keywords,
// relationship ones (champion, job_update…) take no parameters.
export const KEYWORD_AGENT_TYPES = ["keyword_detection", "job_posting_keyword_detection"] as const;
export const SIMPLE_AGENT_TYPES = ["champion", "job_update", "customer", "competitor"] as const;
export type AgentType = (typeof KEYWORD_AGENT_TYPES)[number] | (typeof SIMPLE_AGENT_TYPES)[number];

export function isKeywordAgentType(type: AgentType): boolean {
  return (KEYWORD_AGENT_TYPES as readonly string[]).includes(type);
}

export class SillageSetup {
  private http: AxiosInstance;

  constructor(apiKey: string, http?: AxiosInstance) {
    this.http = http ?? sillageHttp(apiKey);
  }

  async getSetupState(): Promise<SetupState> {
    const { data } = await this.http.get("/v2/setup-state");
    return SetupStateSchema.parse(data);
  }

  async getPersona(): Promise<z.infer<typeof PersonaSchema>["data"]> {
    const { data } = await this.http.get("/v2/persona");
    return PersonaSchema.parse(data).data ?? null;
  }

  async updatePersona(input: PersonaInput): Promise<{ warnings: string[] }> {
    const { data } = await this.http.put("/v2/persona", input);
    return { warnings: PersonaWriteSchema.parse(data).warnings ?? [] };
  }

  async listAgents(): Promise<SillageAgent[]> {
    const { data } = await this.http.get("/v2/agents");
    return AgentListSchema.parse(data).data;
  }

  async createAgent(input: {
    name: string;
    type: AgentType;
    keywords?: string[];
  }): Promise<SillageAgent> {
    // Parameters are decided by the agent TYPE, not by what the caller happens
    // to pass — the API's oneOf schema rejects keywords on relationship types.
    const parameters = isKeywordAgentType(input.type)
      ? { tracking_keywords: input.keywords ?? [] }
      : {};
    const { data } = await this.http.post("/v2/agents", {
      name: input.name,
      type: input.type,
      parameters,
    });
    return AgentCreateSchema.parse(data).data;
  }

  async addAccounts(domains: string[]): Promise<number> {
    await this.http.post("/v2/top-account-list/accounts", {
      accounts: domains.map((domain) => ({ domain })),
    });
    return domains.length;
  }
}

// Same gating as the signal source: real client with a key, null without —
// setup tools report the missing key instead of pretending.
export function makeSillageSetup(
  apiKey: string | undefined = env.SILLAGE_API_KEY,
): SillageSetup | null {
  return apiKey ? new SillageSetup(apiKey) : null;
}
