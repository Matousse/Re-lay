import { describe, expect, it } from "vitest";
import { FakeCrm } from "@/integrations/crm/fake";
import { FakeEnrichment } from "@/integrations/enrichment/fake";
import { FakeLlm } from "@/integrations/llm/fake";
import type { SignalSource } from "@/integrations/signals/port";
import type { Signal } from "@/types/pipeline";
import { PipelineBridge } from "./index";

const NOW = new Date("2026-07-07T12:00:00Z");

// A local stub, not a shipped fake: sig_1 targets Acme (a lost account → runs
// to humanReview), sig_2 targets Globex (active → the graph ends early).
const STUB_SIGNALS: Signal[] = [
  {
    id: "sig_1",
    company: "Acme",
    type: "new_decision_maker",
    detail: "Lea Blanc nommée CMO chez Acme",
    personName: "Lea Blanc",
    personRole: "CMO",
  },
  { id: "sig_2", company: "Globex", type: "funding", detail: "Globex lève 10M€" },
];

const stubSignals: SignalSource = {
  async list() {
    return STUB_SIGNALS;
  },
  async getById(id) {
    return STUB_SIGNALS.find((signal) => signal.id === id) ?? null;
  },
};

function makeBridge() {
  const crm = new FakeCrm();
  const bridge = new PipelineBridge(
    { crm, enrichment: new FakeEnrichment(), llm: new FakeLlm(), signals: stubSignals },
    () => NOW,
  );
  return { bridge, crm };
}

describe("PipelineBridge", () => {
  it("runs the graph up to humanReview and exposes a pending case", async () => {
    const { bridge } = makeBridge();
    const result = await bridge.runSignal("sig_1");
    expect(result).not.toBeNull();
    expect(result?.status).toBe("pending_review");
    expect(result?.plan?.emailDraft.body).toContain("Bonjour Lea");
    expect(bridge.list()).toHaveLength(1);
    expect(bridge.get(result!.id)).toEqual(result);
  });

  it("returns null for unknown signals and non-lost accounts", async () => {
    const { bridge } = makeBridge();
    // sig_2 targets Globex, whose account is active — qualify routes to END.
    expect(await bridge.runSignal("sig_2")).toBeNull();
    expect(await bridge.runSignal("sig_unknown")).toBeNull();
    expect(bridge.list()).toHaveLength(0);
  });

  it("resumes the thread on approve and syncs the CRM", async () => {
    const { bridge, crm } = makeBridge();
    const started = await bridge.runSignal("sig_1");
    expect(crm.writtenNotes).toHaveLength(0);

    const decided = await bridge.decide(started!.id, { action: "approve" });
    expect(decided?.status).toBe("approved");
    expect(decided?.editedEmail).toBeUndefined();
    // syncCrm only runs after the resumed humanReview approves.
    expect(crm.writtenContacts).toHaveLength(1);
    expect(crm.writtenNotes[0]?.text).toContain("Relance:");
  });

  it("keeps the agent draft intact when the rep edits the email", async () => {
    const { bridge } = makeBridge();
    const started = await bridge.runSignal("sig_1");
    const originalSubject = started!.plan!.emailDraft.subject;

    const edited = { subject: "Édité par le rep", body: "Nouveau corps." };
    const decided = await bridge.decide(started!.id, { action: "approve", email: edited });
    expect(decided?.editedEmail).toEqual(edited);
    expect(decided?.plan?.emailDraft.subject).toBe(originalSubject);
  });

  it("resumes with reject and does not touch the CRM", async () => {
    const { bridge, crm } = makeBridge();
    const started = await bridge.runSignal("sig_1");

    const decided = await bridge.decide(started!.id, { action: "reject" });
    expect(decided?.status).toBe("rejected");
    expect(crm.writtenContacts).toHaveLength(0);
    expect(crm.writtenNotes).toHaveLength(0);
  });

  it("refuses to decide twice on the same case", async () => {
    const { bridge } = makeBridge();
    const started = await bridge.runSignal("sig_1");
    await bridge.decide(started!.id, { action: "approve" });
    expect(await bridge.decide(started!.id, { action: "reject" })).toBeNull();
  });

  it("reset clears cases and threads", async () => {
    const { bridge } = makeBridge();
    const started = await bridge.runSignal("sig_1");
    bridge.reset();
    expect(bridge.list()).toHaveLength(0);
    expect(await bridge.decide(started!.id, { action: "approve" })).toBeNull();
  });
});
