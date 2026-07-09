import { beforeEach, describe, expect, it } from "vitest";
import { connectConnector } from "@/services/connectors";
import {
  decideCase,
  getCase,
  getStats,
  listCases,
  resetDemoState,
  simulateIncomingSignal,
} from "@/services/reengagement";

beforeEach(async () => {
  await resetDemoState();
  // The demo boots with Sillage disconnected; these tests exercise the
  // pipeline itself, so bring the stack online first.
  await connectConnector("sillage");
});

describe("listCases", () => {
  it("puts pending cases first, sorted by score descending", async () => {
    const cases = await listCases();
    const pending = cases.filter((c) => c.status === "pending_review");
    expect(cases.slice(0, pending.length).every((c) => c.status === "pending_review")).toBe(true);
    const scores = pending.map((c) => c.verdict.score);
    expect(scores).toEqual(scores.toSorted((a, b) => b - a));
  });
});

describe("decideCase", () => {
  it("approves a pending case and persists the edited email alongside the original draft", async () => {
    const original = (await getCase("case-kerneos"))?.plan?.emailDraft;
    const email = { subject: "Edited", body: "Edited body" };
    const outcome = await decideCase("case-kerneos", { action: "approve", email });
    expect(outcome?.case.status).toBe("approved");
    expect(outcome?.case.editedEmail).toEqual(email);
    expect(outcome?.case.plan?.emailDraft).toEqual(original);
    const fetched = await getCase("case-kerneos");
    expect(fetched?.status).toBe("approved");
    expect(fetched?.editedEmail).toEqual(email);
  });

  it("does not mark an unchanged email as edited", async () => {
    const original = (await getCase("case-wattly"))?.plan?.emailDraft;
    expect(original).toBeDefined();
    const outcome = await decideCase("case-wattly", { action: "approve", email: original });
    expect(outcome?.case.status).toBe("approved");
    expect(outcome?.case.editedEmail).toBeUndefined();
  });

  it("records the chosen angle and treats its own draft as unedited", async () => {
    const kerneos = await getCase("case-kerneos");
    const alt = kerneos?.plan?.altAngles?.[0];
    expect(alt).toBeDefined();
    const outcome = await decideCase("case-kerneos", {
      action: "approve",
      email: alt!.emailDraft,
      angleLabel: alt!.label,
    });
    expect(outcome?.case.approvedAngleLabel).toBe(alt!.label);
    // The alt angle's own email is the baseline, so it is not an "edit".
    expect(outcome?.case.editedEmail).toBeUndefined();
  });

  it("reports CRM sync on approve and skips it (plus notifications) on reject", async () => {
    const approved = await decideCase("case-altiflow", { action: "approve" });
    expect(approved?.effects.crmSynced).toBe(true);
    // No SLACK_WEBHOOK_URL / RESEND_API_KEY in tests, so nothing is sent.
    expect(approved?.effects.slackNotified).toBe(false);
    expect(approved?.effects.emailNotified).toBe(false);
    const rejected = await decideCase("case-wattly", { action: "reject" });
    expect(rejected?.effects.crmSynced).toBe(false);
    expect(rejected?.effects.slackNotified).toBe(false);
    expect(rejected?.effects.emailNotified).toBe(false);
  });

  it("refuses to decide a case twice", async () => {
    await decideCase("case-kerneos", { action: "reject" });
    const second = await decideCase("case-kerneos", { action: "approve" });
    expect(second).toBeNull();
  });

  it("returns null for an unknown case", async () => {
    const outcome = await decideCase("case-unknown", { action: "reject" });
    expect(outcome).toBeNull();
  });
});

describe("getStats", () => {
  it("excludes rejected go cases from the revivable pipeline", async () => {
    const before = await getStats();
    await decideCase("case-kerneos", { action: "reject" });
    const after = await getStats();
    expect(after.revivablePipeline).toBe(before.revivablePipeline - 86_400);
    expect(after.pendingReview).toBe(before.pendingReview - 1);
  });
});

describe("simulateIncomingSignal", () => {
  it("reveals the simulated case, and reset hides it again", async () => {
    expect(await getCase("case-oberon")).toBeNull();
    const simulated = await simulateIncomingSignal();
    expect(simulated?.id).toBe("case-oberon");
    expect(await getCase("case-oberon")).not.toBeNull();
    expect((await listCases()).some((c) => c.id === "case-oberon")).toBe(true);
    await resetDemoState();
    expect(await getCase("case-oberon")).toBeNull();
  });
});
