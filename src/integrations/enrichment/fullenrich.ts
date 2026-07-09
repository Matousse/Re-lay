import axios, { type AxiosInstance } from "axios";
import { z } from "zod";
import type { EnrichedContact } from "@/types/pipeline";
import type { EnrichmentPort } from "@/integrations/enrichment/port";
import { FakeEnrichment } from "@/integrations/enrichment/fake";
import { env } from "@/lib/env";

// Real EnrichmentPort backed by the FullEnrich API v2
// (https://docs.fullenrich.com). Enrichment is asynchronous: POST a one-contact
// batch to /contact/enrich/bulk, then poll /contact/enrich/bulk/{id} until the
// status is terminal and read the verified work email + phone off the first
// row. Every schema below declares only the fields we consume, so additive API
// changes never break us.
//
// The port must always resolve a contact so `researcher` never stalls — so any
// case FullEnrich can't serve (a company-level signal with no person, an empty
// result, spent credits, a timeout, a flaky API) falls back to the same
// synthesized contact the fake produces.

const BASE_URL = "https://app.fullenrich.com/api/v2";

// Enrichment is async; poll until the batch reaches a terminal state. Kept
// bounded so a single enrich() never blocks the pipeline indefinitely.
const POLL_INTERVAL_MS = 3_000;
const MAX_POLLS = 20;

const ENRICH_FIELDS = ["contact.work_emails", "contact.phones"] as const;

const StartResponseSchema = z.object({ enrichment_id: z.string() });

const ResultSchema = z.object({
  // CREATED | IN_PROGRESS | FINISHED | CANCELED | CREDITS_INSUFFICIENT | RATE_LIMIT | UNKNOWN
  status: z.string(),
  data: z
    .array(
      z.object({
        contact_info: z
          .object({
            work_emails: z.array(z.object({ email: z.string() })).nullish(),
            phones: z
              .array(z.object({ number: z.string(), region: z.string().nullish() }))
              .nullish(),
          })
          .nullish(),
      }),
    )
    .nullish(),
});

// Terminal statuses other than FINISHED — nothing more to wait for.
const TERMINAL_FAILURES = new Set(["CANCELED", "CREDITS_INSUFFICIENT", "RATE_LIMIT", "UNKNOWN"]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type EnrichInput = { company: string; personName?: string; personRole?: string };

export class FullEnrichEnrichment implements EnrichmentPort {
  private http: AxiosInstance;
  // Delegated to whenever real enrichment can't return a verified contact.
  private fallback = new FakeEnrichment();

  constructor(
    private apiKey: string,
    http?: AxiosInstance,
  ) {
    this.http =
      http ??
      axios.create({
        baseURL: BASE_URL,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

    // Preserve a readable, path-aware error (axios's default drops the path).
    this.http.interceptors.response.use(undefined, (error) => {
      if (axios.isAxiosError(error)) {
        throw new Error(`FullEnrich API ${error.config?.url} responded ${error.response?.status}`);
      }
      throw error;
    });
  }

  async enrich(input: EnrichInput): Promise<EnrichedContact> {
    // FullEnrich resolves a known person; with no name there is nothing to
    // enrich, so serve the synthesized fallback straight away.
    if (!input.personName) return this.fallback.enrich(input);

    try {
      const id = await this.start(input);
      const contact = await this.poll(id, input);
      return contact ?? this.fallback.enrich(input);
    } catch {
      // A flaky API or spent credits must never break the pipeline run.
      return this.fallback.enrich(input);
    }
  }

  private async start(input: EnrichInput): Promise<string> {
    const [firstName, ...rest] = input.personName!.trim().split(/\s+/);
    const { data } = await this.http.post("/contact/enrich/bulk", {
      name: `Re:lay — ${input.company}`,
      data: [
        {
          first_name: firstName,
          last_name: rest.join(" "),
          company_name: input.company,
          enrich_fields: ENRICH_FIELDS,
        },
      ],
    });
    return StartResponseSchema.parse(data).enrichment_id;
  }

  private async poll(id: string, input: EnrichInput): Promise<EnrichedContact | null> {
    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
      const { data } = await this.http.get(`/contact/enrich/bulk/${id}`);
      const result = ResultSchema.parse(data);

      if (result.status === "FINISHED") return mapResult(result, input);
      if (TERMINAL_FAILURES.has(result.status)) return null;

      await sleep(POLL_INTERVAL_MS);
    }
    return null; // still running after the poll budget → fall back
  }
}

function mapResult(
  result: z.infer<typeof ResultSchema>,
  input: EnrichInput,
): EnrichedContact | null {
  const info = result.data?.[0]?.contact_info;
  const email = info?.work_emails?.[0]?.email;
  if (!email) return null; // no verified email → not actionable, fall back

  const phone = info?.phones?.[0];
  return {
    name: input.personName!,
    role: input.personRole ?? "Décideur",
    email,
    mobile: phone?.number ?? "",
    location: phone?.region ?? "",
  };
}

// Real FullEnrich when FULL_ENRICH_API_KEY is set, deterministic fake otherwise
// — same shape as makeSignalSource, so the demo runs offline and lights up the
// moment the key is present.
export function makeEnrichment(
  apiKey: string | undefined = env.FULL_ENRICH_API_KEY,
): EnrichmentPort {
  return apiKey ? new FullEnrichEnrichment(apiKey) : new FakeEnrichment();
}
