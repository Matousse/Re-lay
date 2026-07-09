import { describe, expect, it, vi } from "vitest";
import type { ChannelMessage } from "@/types/notifications";
import type { ReengagementCase } from "@/types/reengagement";
import { dispatchEvent } from "./notifications";

const CASE = {
  id: "case-oberon",
  deal: {
    id: "opp-1",
    company: { name: "Oberon Systems", domain: "oberon-systems.com", industry: "Cybersecurity" },
    amount: 120_000,
    currency: "EUR",
    lostAt: "2025-10-16",
    lossReason: "competitor",
    lossNotes: "…",
    previousContact: { name: "Hugo Steiner", role: "Head of Sales Ops" },
  },
  signal: {
    id: "sig-1",
    type: "job_change",
    title: "Champion moved to VP Sales Operations",
    description: "…",
    detectedAt: "2026-07-07",
    source: "Sillage",
  },
  autopsy: { summary: "…", lossFactors: [] },
  verdict: { decision: "go", score: 88, reasoning: "…", factors: {} },
  plan: {
    targetContact: {
      name: "Maxime Aubert",
      role: "VP Sales Operations",
      email: "m.aubert@oberon-systems.com",
      enrichment: { providersTried: 2 },
    },
    angle: "…",
    talkingPoints: [],
    emailDraft: { subject: "…", body: "…" },
  },
  status: "approved",
} as unknown as ReengagementCase;

function capturingChannel(result = true) {
  const seen: ChannelMessage[] = [];
  const send = vi.fn(async (message: ChannelMessage) => {
    seen.push(message);
    return result;
  });
  return { send, seen };
}

describe("dispatchEvent", () => {
  it("renders play_approved with company, contact, angle and score for every channel", async () => {
    const slack = capturingChannel();
    const email = capturingChannel();
    const results = await dispatchEvent(
      { type: "play_approved", case: CASE, angleLabel: "Champion re-activation" },
      { slack: slack.send, email: email.send },
    );

    expect(results).toEqual({ slack: true, email: true });
    // Both channels receive the exact same rendered message.
    expect(slack.seen[0]).toEqual(email.seen[0]);
    const message = slack.seen[0];
    expect(message.headline).toContain("Play approved");
    expect(message.headline).toContain("Oberon Systems");
    expect(message.headline).toContain("88/100");
    const facts = JSON.stringify(message.facts);
    expect(facts).toContain("Maxime Aubert");
    expect(facts).toContain("Champion re-activation");
    expect(message.footer).toContain("m.aubert@oberon-systems.com");
  });

  it("renders review_requested with the signal and the human gate", async () => {
    const slack = capturingChannel();
    const email = capturingChannel();
    await dispatchEvent(
      { type: "review_requested", case: CASE },
      { slack: slack.send, email: email.send },
    );

    const message = slack.seen[0];
    expect(message.headline).toContain("ready for review");
    expect(JSON.stringify(message.facts)).toContain("Champion moved to VP Sales Operations");
    expect(message.footer).toContain("until a human approves");
  });

  it("reports each channel independently and survives a throwing channel", async () => {
    const email = capturingChannel();
    const results = await dispatchEvent(
      { type: "play_approved", case: CASE },
      {
        slack: vi.fn(async () => {
          throw new Error("boom");
        }),
        email: email.send,
      },
    );
    expect(results).toEqual({ slack: false, email: true });
  });
});
