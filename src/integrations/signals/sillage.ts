import axios, { type AxiosInstance } from "axios";
import { z } from "zod";
import type { SignalSource } from "@/integrations/signals/port";
import { env } from "@/lib/env";
import { SignalSchema, type Signal } from "@/types/pipeline";

// Real SignalSource backed by the Sillage public API v1
// (https://api.getsillage.com/api/v1/docs). The v1 detection feed is
// person-centric: GET /workspace/signals returns each detection with its
// `signal`, and the `lead` (person) and their `current_company` embedded — so
// names resolve inline, no follow-up lookups. Every schema below declares only
// the fields we consume, so additive API changes never break us.
//
// v1 signal types are snake_case. They map onto the pipeline's Signal type:
//   new_job / recently_promoted            → new_decision_maker
//   job_posting* (open role)               → job_posting
//   keyword_detection (funding words)      → funding
// Anything else is skipped: Re:lay only revives deals on events it can
// argue about.

const BASE_URL = "https://api.getsillage.com";

// v1 paginates by offset; we walk pages but stop at a sane ceiling so a busy
// workspace can never balloon a single list() call.
const PAGE_SIZE = 100;
const MAX_SIGNALS = 500;

const SIGNAL_ID_PREFIX = "slg-";

const LeadSchema = z
  .object({
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    position: z.string().nullish(),
    current_company: z.object({ name: z.string().nullish() }).nullish(),
  })
  .nullish();
type Lead = z.infer<typeof LeadSchema>;

const SignalItemSchema = z.object({
  signal: z.object({
    id: z.string(),
    signal_type: z.string().nullish(),
    signal_date: z.string().nullish(),
    detection_date: z.string().nullish(),
    data: z.unknown().nullish(),
  }),
  lead: LeadSchema,
});
type SignalItem = z.infer<typeof SignalItemSchema>;

const SignalPageSchema = z.object({
  data: z.array(SignalItemSchema),
  meta: z.object({ pagination: z.object({ pageCount: z.number() }).nullish() }).nullish(),
});

const JobPostingDataSchema = z.object({
  posting: z.object({ title: z.string().nullish() }).nullish(),
  job_title: z.string().nullish(),
});
const KeywordDataSchema = z.object({ keywords_found: z.array(z.string()).nullish() });

const FUNDING_PATTERN = /lev[éè]e?|fundrais|raised|series [a-e]\b|seed|financement/i;

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
    const items = await this.fetchSignals();
    return items.map(mapSignalItem).filter((signal): signal is Signal => signal !== null);
  }

  // v1 has no single-detection endpoint, so we resolve one id against the feed.
  async getById(id: string): Promise<Signal | null> {
    if (!id.startsWith(SIGNAL_ID_PREFIX)) return null;
    const signals = await this.list();
    return signals.find((signal) => signal.id === id) ?? null;
  }

  private async fetchSignals(): Promise<SignalItem[]> {
    const items: SignalItem[] = [];
    let page = 1;
    let pageCount = 1;
    do {
      const { data } = await this.http.get("/v1/workspace/signals", {
        params: { page, pageSize: PAGE_SIZE },
      });
      const parsed = SignalPageSchema.parse(data);
      items.push(...parsed.data);
      pageCount = parsed.meta?.pagination?.pageCount ?? page;
      page += 1;
    } while (page <= pageCount && items.length < MAX_SIGNALS);
    return items;
  }
}

function mapSignalItem({ signal, lead }: SignalItem): Signal | null {
  const company = lead?.current_company?.name;
  if (!company) return null;

  const base = { id: `${SIGNAL_ID_PREFIX}${signal.id}`, company };

  switch (signal.signal_type) {
    case "new_job":
    case "recently_promoted": {
      const personName = [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || undefined;
      const role = lead?.position ?? undefined;
      return SignalSchema.parse({
        ...base,
        type: "new_decision_maker",
        detail: `${personName ?? "Un nouveau décideur"} arrive comme ${role ?? "décideur"} chez ${company}`,
        personName,
        personRole: role,
      });
    }
    case "job_posting":
    case "job_posting_insight":
    case "job_posting_hiring_manager":
    case "job_posting_keyword_detection": {
      const data = JobPostingDataSchema.safeParse(signal.data);
      const title =
        (data.success ? (data.data.posting?.title ?? data.data.job_title) : null) ?? "un poste clé";
      return SignalSchema.parse({
        ...base,
        type: "job_posting",
        detail: `${company} recrute : ${title}`,
      });
    }
    case "keyword_detection": {
      const data = KeywordDataSchema.safeParse(signal.data);
      const keywords = (data.success ? data.data.keywords_found : null) ?? [];
      if (!keywords.some((keyword) => FUNDING_PATTERN.test(keyword))) return null;
      return SignalSchema.parse({
        ...base,
        type: "funding",
        detail: `${company} — signal de levée détecté (${keywords.join(", ")})`,
      });
    }
    default:
      return null;
  }
}

// With no key the workspace is simply unavailable — the app surfaces no
// signals rather than any seeded stand-in. Real signals require SILLAGE_API_KEY.
const OFFLINE_SOURCE: SignalSource = {
  async list() {
    return [];
  },
  async getById() {
    return null;
  },
};

export function makeSignalSource(apiKey: string | undefined = env.SILLAGE_API_KEY): SignalSource {
  return apiKey ? new SillageSignalSource(apiKey) : OFFLINE_SOURCE;
}
