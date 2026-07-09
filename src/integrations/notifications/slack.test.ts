import { describe, expect, it, vi } from "vitest";
import type { ChannelMessage } from "@/types/notifications";
import { postToSlack } from "./slack";

const MESSAGE: ChannelMessage = {
  headline: "🔥 Play approved — Oberon Systems (88/100)",
  facts: [
    { label: "Company", value: "Oberon Systems · €120,000 recovered" },
    { label: "Angle", value: "Champion re-activation" },
  ],
  footer: "Re:lay drafted the outreach to m.aubert@oberon-systems.com",
};

describe("postToSlack", () => {
  it("does nothing and reports not-notified when no webhook is configured", async () => {
    const fetchImpl = vi.fn();
    const notified = await postToSlack(MESSAGE, {
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
    const notified = await postToSlack(MESSAGE, {
      webhookUrl: "https://hooks.slack.com/services/T/B/X",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(notified).toBe(true);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://hooks.slack.com/services/T/B/X");
    const body = JSON.parse(init!.body as string);
    expect(body.text).toContain("Oberon Systems");
    expect(body.text).toContain("88/100");
    const blocks = JSON.stringify(body.blocks);
    expect(blocks).toContain("*Angle:*");
    expect(blocks).toContain("Champion re-activation");
    expect(blocks).toContain("m.aubert@oberon-systems.com");
  });

  it("reports failure on a non-2xx webhook response", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 500 }));
    expect(
      await postToSlack(MESSAGE, {
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
      await postToSlack(MESSAGE, {
        webhookUrl: "https://hooks.slack.com/services/T/B/X",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).toBe(false);
  });
});
