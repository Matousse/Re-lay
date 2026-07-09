import { z } from "zod";
import { ClosedLostAccountSchema } from "@/types/pipeline";

// The Sillage workspace persona (ICP). Replace-whole on PUT /persona, so the
// service always GET → merges → PUT the full object. job_title[] and location[]
// are the minimum Sillage needs; additional_info is the free-text ICP note.
export const DerivedPersonaSchema = z.object({
  job_title: z.array(z.string()),
  location: z.array(z.string()),
  additional_info: z.string(),
});
export type DerivedPersona = z.infer<typeof DerivedPersonaSchema>;

// GET /api/sillage/accounts — everything the connect modal needs: the closed-lost
// companies to pick from, and the persona derived from their contacts.
export const ClosedLostSyncDataSchema = z.object({
  accounts: z.array(ClosedLostAccountSchema),
  persona: DerivedPersonaSchema,
});
export type ClosedLostSyncData = z.infer<typeof ClosedLostSyncDataSchema>;

// POST /api/sillage/sync — the user's kept domains and the persona they confirmed.
export const SillageSyncInputSchema = z.object({
  domains: z.array(z.string().min(1)).min(1),
  persona: DerivedPersonaSchema,
});
export type SillageSyncInput = z.infer<typeof SillageSyncInputSchema>;

// The four steps of the create-agents-sillage procedure, in order. The modal
// renders one live row per step.
export const SYNC_STEPS = ["accounts", "persona", "agents", "runs"] as const;
export type SyncStep = (typeof SYNC_STEPS)[number];

export type AgentAction = "created" | "activated" | "reconfigured" | "unchanged";

export type SyncSummary = {
  accounts: { added: number; resolved: number; notFound: string[] };
  persona: { jobTitles: number; locations: number };
  agents: { type: string; action: AgentAction; id: number }[];
  runs: { agentId: number; signalRequestIds: number[] }[];
};

// Progress events streamed to the modal as NDJSON (one per line), mirroring the
// assistant's AssistantEvent contract so the UI can animate the work live.
export type SillageSyncEvent =
  | { type: "step_start"; step: SyncStep; label: string }
  | { type: "step_end"; step: SyncStep; ok: boolean; detail?: string }
  | { type: "done"; summary: SyncSummary }
  | { type: "error"; message: string };
