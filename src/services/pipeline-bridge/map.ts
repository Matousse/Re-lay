import { SCORE_FACTORS } from "@/lib/score";
import type { PipelineStateType } from "@/services/pipeline/state";
import type { Signal as PipelineSignal } from "@/types/pipeline";
import {
  ReengagementCaseSchema,
  type LossReason,
  type ReengagementCase,
  type SignalType,
  type Verdict,
} from "@/types/reengagement";

// Translation layer between the LangGraph pipeline state (src/types/pipeline)
// and the front contract (src/types/reengagement). Pure and deterministic:
// same state + same clock → same case, so it is trivially testable and demo
// runs are reproducible.

const SIGNAL_TYPE_MAP: Record<PipelineSignal["type"], SignalType> = {
  new_decision_maker: "exec_change",
  funding: "funding",
  site_revisit: "site_revisit",
  job_posting: "hiring_surge",
};

const SIGNAL_TITLES: Record<PipelineSignal["type"], (company: string) => string> = {
  new_decision_maker: (company) => `New decision maker at ${company}`,
  funding: (company) => `${company} raised a new round`,
  site_revisit: (company) => `${company} is back on the website`,
  job_posting: (company) => `${company} is hiring for a key role`,
};

// The CRM stores lossReason as free text — collapse it onto the front enum.
const LOSS_REASON_PATTERNS: [RegExp, LossReason][] = [
  [/budget/i, "no_budget"],
  [/pri(x|ce)|cher|cost/i, "price"],
  [/concurrent|competitor/i, "competitor"],
  [/timing|trop tôt|too early/i, "timing"],
  [/stakeholder|sponsor|bloqu/i, "blocked_by_stakeholder"],
];

export function mapLossReason(raw: string | null): LossReason {
  for (const [pattern, reason] of LOSS_REASON_PATTERNS) {
    if (raw && pattern.test(raw)) return reason;
  }
  return "no_need";
}

// Static facts the CRM fake doesn't carry (deal size, industry, who we lost
// to) for the companies seeded in src/integrations/crm/data.json, with a
// deterministic fallback so any future seed still maps to a valid deal.
const DEAL_FACTS: Record<
  string,
  { amount: number; industry: string; previousContact: { name: string; role: string } }
> = {
  Acme: {
    amount: 48_000,
    industry: "Marketing tech",
    previousContact: { name: "Paul Roy", role: "CMO" },
  },
  Globex: {
    amount: 72_000,
    industry: "Logistics",
    previousContact: { name: "Alex Munoz", role: "VP Ops" },
  },
};

function fallbackDealFacts(company: string) {
  const hash = [...company].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {
    amount: 20_000 + (hash % 13) * 5_000,
    industry: "Software",
    previousContact: { name: "Former sponsor", role: "Decision maker" },
  };
}

const GO_THRESHOLD = 60;

const SIGNAL_STRENGTH: Record<PipelineSignal["type"], { score: number; note: string }> = {
  new_decision_maker: {
    score: 85,
    note: "A new decision maker is a fresh entry point, unburdened by the past 'no'.",
  },
  funding: { score: 80, note: "Fresh funding usually unlocks the budget line that was missing." },
  site_revisit: {
    score: 65,
    note: "Renewed website activity shows intent, but no named buyer yet.",
  },
  job_posting: {
    score: 70,
    note: "Hiring for the role your product serves means the pain is now staffed.",
  },
};

// How well the new signal neutralizes the original loss reason.
const LOSS_REASON_FIT: Partial<Record<`${LossReason}:${PipelineSignal["type"]}`, number>> = {
  "no_budget:funding": 95,
  "price:funding": 90,
  "no_budget:new_decision_maker": 70,
  "blocked_by_stakeholder:new_decision_maker": 95,
  "competitor:new_decision_maker": 80,
  "timing:site_revisit": 85,
  "no_need:job_posting": 80,
};

function timingFactor(lostAt: string | null, now: Date): Verdict["factors"]["timing"] {
  if (!lostAt) return { score: 50, note: "Loss date unknown — timing impact is a guess." };
  const months = Math.max(
    0,
    Math.round((now.getTime() - new Date(lostAt).getTime()) / (1000 * 60 * 60 * 24 * 30)),
  );
  if (months < 3) {
    return { score: 40, note: `Lost only ${months} mo ago — the 'no' is still fresh.` };
  }
  if (months <= 24) {
    return { score: 85, note: `Lost ${months} mo ago — long enough for context to change.` };
  }
  return { score: 55, note: `Lost ${months} mo ago — relationship has gone cold.` };
}

function computeVerdict(input: {
  signalType: PipelineSignal["type"];
  lossReason: LossReason;
  lostAt: string | null;
  rootCause: string;
  now: Date;
}): Verdict {
  const factors: Verdict["factors"] = {
    signalStrength: SIGNAL_STRENGTH[input.signalType],
    lossReasonFit: {
      score: LOSS_REASON_FIT[`${input.lossReason}:${input.signalType}`] ?? 60,
      note: `Signal weighed against the original loss reason (${input.lossReason.replace(/_/g, " ")}).`,
    },
    timing: timingFactor(input.lostAt, input.now),
  };
  const score = Math.round(
    SCORE_FACTORS.reduce((sum, factor) => sum + factors[factor.key].score * factor.weight, 0),
  );
  return {
    decision: score >= GO_THRESHOLD ? "go" : "no_go",
    score,
    reasoning: input.rootCause,
    factors,
  };
}

export function toReengagementCase(input: {
  state: PipelineStateType;
  caseId: string;
  now?: Date;
}): ReengagementCase {
  const { state, caseId } = input;
  const now = input.now ?? new Date();
  const { signal, account, lossAnalysis, targetContact, draft } = state;
  if (!account || !lossAnalysis) {
    throw new Error(`Pipeline state for ${caseId} is missing account or loss analysis`);
  }
  const facts = DEAL_FACTS[account.company] ?? fallbackDealFacts(account.company);
  const lossReason = mapLossReason(account.lossReason);

  return ReengagementCaseSchema.parse({
    id: caseId,
    deal: {
      id: account.id,
      company: {
        name: account.company,
        domain: `${account.company.toLowerCase().replace(/\s+/g, "")}.com`,
        industry: facts.industry,
      },
      amount: facts.amount,
      currency: "EUR",
      lostAt: account.lostAt ?? now.toISOString().slice(0, 10),
      lossReason,
      lossNotes: account.notes.map((note) => note.text).join(" "),
      previousContact: facts.previousContact,
    },
    signal: {
      id: signal.id,
      type: SIGNAL_TYPE_MAP[signal.type],
      title: SIGNAL_TITLES[signal.type](signal.company),
      description: signal.detail,
      detectedAt: now.toISOString().slice(0, 10),
      source: "Sillage",
    },
    autopsy: {
      summary: lossAnalysis.rootCause,
      lossFactors: lossAnalysis.evidence,
    },
    verdict: computeVerdict({
      signalType: signal.type,
      lossReason,
      lostAt: account.lostAt,
      rootCause: lossAnalysis.rootCause,
      now,
    }),
    plan:
      targetContact && draft
        ? {
            targetContact: {
              name: targetContact.name,
              role: targetContact.role,
              email: targetContact.email,
              phone: targetContact.mobile,
              enrichment: { providersTried: 3 },
            },
            angle: lossAnalysis.newAngle,
            talkingPoints: lossAnalysis.evidence,
            emailDraft: { subject: draft.subject, body: draft.body },
          }
        : null,
    status: "pending_review",
  } satisfies ReengagementCase);
}
