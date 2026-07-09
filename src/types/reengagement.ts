import { z } from "zod";

export const SignalTypeSchema = z.enum([
  "job_change",
  "funding",
  "competitor_issue",
  "hiring_surge",
  "exec_change",
  "site_revisit",
]);

export const LossReasonSchema = z.enum([
  "price",
  "competitor",
  "no_budget",
  "no_need",
  "blocked_by_stakeholder",
  "timing",
]);

export const CaseStatusSchema = z.enum(["pending_review", "approved", "rejected", "no_go"]);

export const SignalSchema = z.object({
  id: z.string(),
  type: SignalTypeSchema,
  title: z.string(),
  description: z.string(),
  detectedAt: z.string(),
  source: z.string(),
});

export const LostDealSchema = z.object({
  id: z.string(),
  company: z.object({
    name: z.string(),
    domain: z.string(),
    industry: z.string(),
  }),
  amount: z.number(),
  currency: z.literal("EUR"),
  lostAt: z.string(),
  lossReason: LossReasonSchema,
  lossNotes: z.string(),
  previousContact: z.object({
    name: z.string(),
    role: z.string(),
  }),
});

export const AutopsySchema = z.object({
  summary: z.string(),
  lossFactors: z.array(z.string()),
});

export const VerdictFactorSchema = z.object({
  score: z.number().min(0).max(100),
  note: z.string(),
});

export const VerdictSchema = z.object({
  decision: z.enum(["go", "no_go"]),
  score: z.number().min(0).max(100),
  reasoning: z.string(),
  factors: z.object({
    signalStrength: VerdictFactorSchema,
    lossReasonFit: VerdictFactorSchema,
    timing: VerdictFactorSchema,
  }),
});

export const TargetContactSchema = z.object({
  name: z.string(),
  role: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  enrichment: z.object({
    providersTried: z.number().int().min(1),
  }),
});

export const EmailDraftSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});

// An alternative way back into the account: a short name, why it works now,
// and the email that carries it. The strategist can surface more than one so
// the rep chooses the framing instead of just accepting a single draft.
export const OutreachAngleSchema = z.object({
  id: z.string(),
  label: z.string(),
  rationale: z.string(),
  emailDraft: EmailDraftSchema,
});

export const PlanSchema = z.object({
  targetContact: TargetContactSchema,
  angle: z.string(),
  talkingPoints: z.array(z.string()),
  emailDraft: EmailDraftSchema,
  // Short label for the recommended angle carried in `angle`/`emailDraft`.
  angleLabel: z.string().optional(),
  // Extra angles the rep can switch to in the decision screen. When present,
  // the recommended angle above is the default choice.
  altAngles: z.array(OutreachAngleSchema).optional(),
});

export const ReengagementCaseSchema = z.object({
  id: z.string(),
  deal: LostDealSchema,
  signal: SignalSchema,
  autopsy: AutopsySchema,
  verdict: VerdictSchema,
  plan: PlanSchema.nullable(),
  status: CaseStatusSchema,
  // Set once a rep approves with edits; plan.emailDraft always stays the
  // agent's original so the two can be diffed.
  editedEmail: EmailDraftSchema.optional(),
  // Which angle the rep approved (its label), kept for the CRM receipt and
  // the Slack announcement.
  approvedAngleLabel: z.string().optional(),
});

export const DemoInputSchema = z.object({
  action: z.enum(["simulate", "reset"]),
});

export const DecisionInputSchema = z.object({
  action: z.enum(["approve", "reject"]),
  email: EmailDraftSchema.optional(),
  angleLabel: z.string().optional(),
});

// What Re:lay did as a side effect of a decision — surfaced to the rep as the
// sync receipt and notification toasts.
export type DecisionEffects = {
  crmSynced: boolean;
  slackNotified: boolean;
  emailNotified: boolean;
  syncedAt: string;
};

export type SignalType = z.infer<typeof SignalTypeSchema>;
export type VerdictFactor = z.infer<typeof VerdictFactorSchema>;
export type LossReason = z.infer<typeof LossReasonSchema>;
export type CaseStatus = z.infer<typeof CaseStatusSchema>;
export type Signal = z.infer<typeof SignalSchema>;
export type LostDeal = z.infer<typeof LostDealSchema>;
export type Autopsy = z.infer<typeof AutopsySchema>;
export type Verdict = z.infer<typeof VerdictSchema>;
export type TargetContact = z.infer<typeof TargetContactSchema>;
export type EmailDraft = z.infer<typeof EmailDraftSchema>;
export type OutreachAngle = z.infer<typeof OutreachAngleSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type ReengagementCase = z.infer<typeof ReengagementCaseSchema>;
export type DecisionInput = z.infer<typeof DecisionInputSchema>;
