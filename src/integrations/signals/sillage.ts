import axios, { type AxiosInstance } from "axios";
import { z } from "zod";
import { FakeSignalSource } from "@/integrations/signals/fake";
import type { SignalSource } from "@/integrations/signals/port";
import { env } from "@/lib/env";
import { SignalSchema, type Signal } from "@/types/pipeline";

// Real SignalSource backed by the Sillage public API
// (https://www.getsillage.com/docs/api). Response schemas below mirror the
// published OpenAPI spec (api.getsillage.com/api/v1/docs/spec) but only
// declare the fields we consume, so additive API changes never break us.
//
// Detections are translated onto the pipeline's Signal type:
//   newJob / recentlyPromoted        → new_decision_maker
//   jobPosting* (open role)          → job_posting
//   keywordDetection (funding words) → funding
// Anything else is skipped: Re:lay only revives deals on events it can
// argue about.

const BASE_URL = "https://api.getsillage.com";

const DetectionSchema = z.object({
  id: z.number(),
  signal_type: z.string().nullish(),
  data: z.unknown().nullish(),
  signal_date: z.string().nullish(),
  lead_id: z.number().nullish(),
  company_id: z.number().nullish(),
});
const DetectionListSchema = z.object({ data: z.array(DetectionSchema) });
const DetectionItemSchema = z.object({ data: DetectionSchema });

const PositionSchema = z
  .object({ role: z.string().nullish(), company_name: z.string().nullish() })
  .nullish();
const JobUpdateDataSchema = z.object({
  previous_position: PositionSchema,
  new_position: PositionSchema,
});
const JobPostingDataSchema = z.object({
  posting: z.object({ title: z.string().nullish(), company_name: z.string().nullish() }).nullish(),
  job_title: z.string().nullish(),
});
const KeywordDataSchema = z.object({ keywords_found: z.array(z.string()).nullish() });

// v1 leads carry string ids; v2 detections reference them via numeric
// lead_id — index by stringified id and match both ways.
const LeadSchema = z.object({
  id: z.union([z.string(), z.number()]),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  position: z.string().nullish(),
  company: z.object({ name: z.string().nullish() }).nullish(),
});
const LeadListSchema = z.object({ data: z.array(LeadSchema) });

const TopAccountSchema = z.object({ id: z.number(), name: z.string().nullish() });
const TopAccountListSchema = z.object({ data: z.array(TopAccountSchema) });

type Lead = z.infer<typeof LeadSchema>;

const FUNDING_PATTERN = /lev[éè]e?|fundrais|raised|series [a-e]\b|seed|financement/i;

const SIGNAL_ID_PREFIX = "slg-";

export class SillageSignalSource implements SignalSource {
  private http: AxiosInstance;

  constructor(
    private apiKey: string,
    http?: AxiosInstance,
  ) {
    this.http =
      http ??
      axios.create({
        baseURL: `${BASE_URL}/api`,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

    // Preserve the readable, path-aware error the hand-rolled fetch wrapper
    // used to throw — axios's default message drops the path.
    this.http.interceptors.response.use(undefined, (error) => {
      if (axios.isAxiosError(error)) {
        throw new Error(`Sillage API ${error.config?.url} responded ${error.response?.status}`);
      }
      throw error;
    });
  }

  async list(): Promise<Signal[]> {
    const [detections, leads, companies] = await Promise.all([
      this.fetchDetections(),
      this.fetchLeadIndex(),
      this.fetchCompanyIndex(),
    ]);
    return detections
      .map((detection) => mapDetection(detection, leads, companies))
      .filter((signal): signal is Signal => signal !== null);
  }

  async getById(id: string): Promise<Signal | null> {
    if (!id.startsWith(SIGNAL_ID_PREFIX)) return null;
    const detectionId = Number(id.slice(SIGNAL_ID_PREFIX.length));
    if (!Number.isInteger(detectionId)) return null;

    const [payload, leads, companies] = await Promise.all([
      this.http.get(`/v2/workspace/signals/${detectionId}`).then((r) => r.data),
      this.fetchLeadIndex(),
      this.fetchCompanyIndex(),
    ]);
    return mapDetection(DetectionItemSchema.parse(payload).data, leads, companies);
  }

  private async fetchDetections() {
    const { data } = await this.http.post("/v2/workspace/signals/query", { limit: 50 });
    return DetectionListSchema.parse(data).data;
  }

  private async fetchLeadIndex(): Promise<Map<string, Lead>> {
    const { data } = await this.http.get("/v1/workspace/leads?pageSize=100");
    const leads = LeadListSchema.parse(data).data;
    return new Map(leads.map((lead) => [String(lead.id), lead]));
  }

  private async fetchCompanyIndex(): Promise<Map<number, string>> {
    const { data } = await this.http.get("/v2/top-accounts?limit=250");
    const accounts = TopAccountListSchema.parse(data).data;
    return new Map(
      accounts.filter((a) => a.name).map((account) => [account.id, account.name as string]),
    );
  }
}

function mapDetection(
  detection: z.infer<typeof DetectionSchema>,
  leads: Map<string, Lead>,
  companies: Map<number, string>,
): Signal | null {
  const lead = detection.lead_id != null ? leads.get(String(detection.lead_id)) : undefined;
  const base = {
    id: `${SIGNAL_ID_PREFIX}${detection.id}`,
    company:
      (detection.company_id != null ? companies.get(detection.company_id) : undefined) ??
      lead?.company?.name ??
      companyFromPayload(detection),
  };
  if (!base.company) return null;

  switch (detection.signal_type) {
    case "newJob":
    case "recentlyPromoted": {
      const data = JobUpdateDataSchema.safeParse(detection.data);
      const role = (data.success ? data.data.new_position?.role : null) ?? lead?.position ?? null;
      const personName = [lead?.firstName, lead?.lastName].filter(Boolean).join(" ") || undefined;
      return SignalSchema.parse({
        ...base,
        type: "new_decision_maker",
        detail: `${personName ?? "Un nouveau décideur"} arrive comme ${role ?? "décideur"} chez ${base.company}`,
        personName,
        personRole: role ?? undefined,
      });
    }
    case "jobPosting":
    case "jobPostingInsight":
    case "jobPostingHiringManager": {
      const data = JobPostingDataSchema.safeParse(detection.data);
      const title =
        (data.success ? (data.data.posting?.title ?? data.data.job_title) : null) ?? "un poste clé";
      return SignalSchema.parse({
        ...base,
        type: "job_posting",
        detail: `${base.company} recrute : ${title}`,
      });
    }
    case "keywordDetection": {
      const data = KeywordDataSchema.safeParse(detection.data);
      const keywords = (data.success ? data.data.keywords_found : null) ?? [];
      if (!keywords.some((keyword) => FUNDING_PATTERN.test(keyword))) return null;
      return SignalSchema.parse({
        ...base,
        type: "funding",
        detail: `${base.company} — signal de levée détecté (${keywords.join(", ")})`,
      });
    }
    default:
      return null;
  }
}

function companyFromPayload(detection: z.infer<typeof DetectionSchema>): string | null {
  const jobUpdate = JobUpdateDataSchema.safeParse(detection.data);
  if (jobUpdate.success && jobUpdate.data.new_position?.company_name) {
    return jobUpdate.data.new_position.company_name;
  }
  const jobPosting = JobPostingDataSchema.safeParse(detection.data);
  if (jobPosting.success && jobPosting.data.posting?.company_name) {
    return jobPosting.data.posting.company_name;
  }
  return null;
}

// The demo's default: real Sillage workspace when a key is configured,
// seeded fake otherwise — same contract either way.
export function makeSignalSource(apiKey: string | undefined = env.SILLAGE_API_KEY): SignalSource {
  return apiKey ? new SillageSignalSource(apiKey) : new FakeSignalSource();
}
