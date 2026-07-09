import { describe, expect, it } from "vitest";
import type { PipelineStateType } from "@/services/pipeline/state";
import { ReengagementCaseSchema } from "@/types/reengagement";
import { mapLossReason, toReengagementCase } from "./map";

const NOW = new Date("2026-07-07T12:00:00Z");

const ACME_STATE: PipelineStateType = {
  signal: {
    id: "sig_1",
    company: "Acme",
    type: "new_decision_maker",
    detail: "Lea Blanc nommée CMO chez Acme",
    personName: "Lea Blanc",
    personRole: "CMO",
  },
  account: {
    id: "acc_1",
    company: "Acme",
    status: "lost",
    lossReason: "budget",
    lostAt: "2024-03-10",
    notes: [{ date: "2024-03-10", author: "Sam", text: "Deal clos perdu : pas de budget." }],
  },
  lossAnalysis: {
    rootCause: "Pas de budget validé côté marketing.",
    evidence: ["2024-03-10 — Deal clos perdu : pas de budget."],
    newAngle: "Nouvelle CMO : repartir de la valeur démontrée.",
  },
  targetContact: {
    name: "Lea Blanc",
    role: "CMO",
    email: "lea.blanc@acme.com",
    mobile: "+33 6 12 34 56 78",
    location: "Paris, France",
  },
  draft: {
    subject: "Acme × Re:lay — le contexte a changé",
    body: "Bonjour Lea, ...",
    rationale: "Relance justifiée par le signal.",
  },
  humanDecision: null,
  error: null,
};

describe("mapLossReason", () => {
  it("collapses free-text CRM reasons onto the front enum", () => {
    expect(mapLossReason("budget")).toBe("no_budget");
    expect(mapLossReason("Trop cher vs valeur perçue")).toBe("price");
    expect(mapLossReason("parti chez un concurrent")).toBe("competitor");
    expect(mapLossReason("bad timing")).toBe("timing");
    expect(mapLossReason("bloqué par le sponsor")).toBe("blocked_by_stakeholder");
    expect(mapLossReason(null)).toBe("no_need");
    expect(mapLossReason("autre chose")).toBe("no_need");
  });
});

describe("toReengagementCase", () => {
  it("produces a schema-valid case from an interrupted pipeline state", () => {
    const result = toReengagementCase({ state: ACME_STATE, caseId: "run-test", now: NOW });
    expect(() => ReengagementCaseSchema.parse(result)).not.toThrow();
    expect(result.id).toBe("run-test");
    expect(result.status).toBe("pending_review");
    expect(result.deal.company.name).toBe("Acme");
    expect(result.deal.lossReason).toBe("no_budget");
    expect(result.signal.type).toBe("exec_change");
    expect(result.signal.source).toBe("Sillage");
    expect(result.plan?.targetContact.email).toBe("lea.blanc@acme.com");
    expect(result.plan?.emailDraft.subject).toBe("Acme × Re:lay — le contexte a changé");
    expect(result.plan?.angle).toBe("Nouvelle CMO : repartir de la valeur démontrée.");
  });

  it("computes a deterministic weighted verdict", () => {
    const result = toReengagementCase({ state: ACME_STATE, caseId: "run-test", now: NOW });
    // 40% signalStrength (85) + 40% lossReasonFit (no_budget:new_decision_maker
    // = 70) + 20% timing (lost ~28 months before NOW = 55) = 73.
    expect(result.verdict.factors.signalStrength.score).toBe(85);
    expect(result.verdict.factors.lossReasonFit.score).toBe(70);
    expect(result.verdict.factors.timing.score).toBe(55);
    expect(result.verdict.score).toBe(73);
    expect(result.verdict.decision).toBe("go");
  });

  it("scores recent losses lower on timing", () => {
    const state: PipelineStateType = {
      ...ACME_STATE,
      account: { ...ACME_STATE.account!, lostAt: "2026-06-01" },
    };
    const result = toReengagementCase({ state, caseId: "run-test", now: NOW });
    expect(result.verdict.factors.timing.score).toBe(40);
  });

  it("throws when the state is missing the account or the analysis", () => {
    const state: PipelineStateType = { ...ACME_STATE, lossAnalysis: null };
    expect(() => toReengagementCase({ state, caseId: "run-test", now: NOW })).toThrow(
      /missing account or loss analysis/,
    );
  });
});
