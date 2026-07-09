import { describe, expect, it, vi } from "vitest";
import type { ReengagementCase } from "@/types/reengagement";
import { notifyPlayApproved } from "./slack";

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
    title: "…",
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

describe("notifyPlayApproved", () => {
  it("does nothing and reports not-notified when no webhook is configured", async () => {
    const fetchImpl = vi.fn();
    const notified = await notifyPlayApproved(CASE, "Champion re-activation", {
      webhookUrl: undefined,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(notified).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts a Block Kit payload and reports success", async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 200 }),
    );
    const notified = await notifyPlayApproved(CASE, "Champion re-activation", {
      webhookUrl: "https://hooks.slack.com/services/T/B/X",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(notified).toBe(true);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://hooks.slack.com/services/T/B/X");
    const body = JSON.parse(init!.body as string);
    expect(body.text).toContain("Oberon Systems");
    expect(body.text).toContain("88/100");
    expect(JSON.stringify(body.blocks)).toContain("Champion re-activation");
    expect(JSON.stringify(body.blocks)).toContain("Maxime Aubert");
  });

  it("reports failure on a non-2xx webhook response", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 500 }));
    expect(
      await notifyPlayApproved(CASE, undefined, {
        webhookUrl: "https://hooks.slack.com/services/T/B/X",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).toBe(false);
  });

  it("never throws when the webhook is unreachable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    });
    expect(
      await notifyPlayApproved(CASE, undefined, {
        webhookUrl: "https://hooks.slack.com/services/T/B/X",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).toBe(false);
  });
});
