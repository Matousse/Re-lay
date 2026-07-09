import { z } from "zod";

export const NoteSchema = z.object({
  date: z.string(),
  author: z.string(),
  text: z.string().min(1),
});
export type Note = z.infer<typeof NoteSchema>;

export const SignalSchema = z.object({
  id: z.string(),
  company: z.string(),
  // Aligné sur les détections de l'API Sillage v2 : new_decision_maker ←
  // newJob/recentlyPromoted, funding ← keywordDetection (mots-clés levée),
  // job_posting ← jobPosting*. site_revisit reste couvert par le fake.
  type: z.enum(["new_decision_maker", "funding", "site_revisit", "job_posting"]),
  detail: z.string(),
  personName: z.string().optional(),
  personRole: z.string().optional(),
});
export type Signal = z.infer<typeof SignalSchema>;

export const AccountSchema = z.object({
  id: z.string(),
  company: z.string(),
  status: z.enum(["lost", "active", "won"]),
  lossReason: z.string().nullable(),
  lostAt: z.string().nullable(),
  notes: z.array(NoteSchema),
});
export type Account = z.infer<typeof AccountSchema>;

// A person who owned a closed-lost deal — the raw material the Sillage persona
// is derived from (title → job_title[], location → location[]).
export const ClosedLostContactSchema = z.object({
  name: z.string(),
  jobTitle: z.string(),
  location: z.string(),
});
export type ClosedLostContact = z.infer<typeof ClosedLostContactSchema>;

// One closed-lost account, flattened for the Sillage sync: the company domain
// (Sillage's preferred identifier) plus the contacts who owned the deal. Distinct
// from Account — it carries the domain/contacts the pipeline's Account omits.
export const ClosedLostAccountSchema = z.object({
  id: z.string(),
  company: z.string(),
  domain: z.string(),
  amount: z.number().nullable(),
  lossReason: z.string().nullable(),
  contacts: z.array(ClosedLostContactSchema),
});
export type ClosedLostAccount = z.infer<typeof ClosedLostAccountSchema>;

export const LossAnalysisSchema = z.object({
  rootCause: z.string(),
  evidence: z.array(z.string()),
  newAngle: z.string(),
});
export type LossAnalysis = z.infer<typeof LossAnalysisSchema>;

export const EnrichedContactSchema = z.object({
  name: z.string(),
  role: z.string(),
  email: z.string(),
  mobile: z.string(),
  location: z.string(),
});
export type EnrichedContact = z.infer<typeof EnrichedContactSchema>;

export const OutreachDraftSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  rationale: z.string(),
});
export type OutreachDraft = z.infer<typeof OutreachDraftSchema>;

export const HumanDecisionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("approve") }),
  z.object({ type: z.literal("edit"), draft: OutreachDraftSchema }),
  z.object({ type: z.literal("reject") }),
]);
export type HumanDecision = z.infer<typeof HumanDecisionSchema>;

// Frontières HTTP
export const StartPipelineInputSchema = z.object({ signalId: z.string().min(1) });
export const ResumePipelineInputSchema = z.object({
  threadId: z.string().min(1),
  decision: HumanDecisionSchema,
});
