import { describe, expect, it, vi } from "vitest";
import type { ChannelMessage } from "@/types/notifications";
import { sendEmail } from "./email";

const MESSAGE: ChannelMessage = {
  headline: "🔥 Play approved — Oberon Systems (88/100)",
  facts: [{ label: "Company", value: "Oberon <Systems> · €120,000 recovered" }],
  footer: "Re:lay drafted the outreach to m.aubert@oberon-systems.com",
};

const OPTIONS = { apiKey: "re_test_key", to: "sales@team.dev" };

describe("sendEmail", () => {
  it("does nothing without an API key", async () => {
    const fetchImpl = vi.fn();
    const notified = await sendEmail(MESSAGE, {
      ...OPTIONS,
      apiKey: undefined,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(notified).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does nothing without a recipient", async () => {
    const fetchImpl = vi.fn();
    const notified = await sendEmail(MESSAGE, {
      ...OPTIONS,
      to: undefined,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(notified).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts the message to Resend with the key and reports success", async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 200 }),
    );
    const notified = await sendEmail(MESSAGE, {
      ...OPTIONS,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(notified).toBe(true);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer re_test_key");
    const body = JSON.parse(init!.body as string);
    expect(body.to).toEqual(["sales@team.dev"]);
    expect(body.subject).toContain("Oberon Systems");
    // Values are escaped into the HTML body.
    expect(body.html).toContain("Oberon &lt;Systems&gt;");
    expect(body.html).toContain("m.aubert@oberon-systems.com");
  });

  it("reports failure on a non-2xx response and never throws when down", async () => {
    const rejected = vi.fn(async () => new Response(null, { status: 422 }));
    expect(
      await sendEmail(MESSAGE, { ...OPTIONS, fetchImpl: rejected as unknown as typeof fetch }),
    ).toBe(false);

    const down = vi.fn(async () => {
      throw new Error("network down");
    });
    expect(
      await sendEmail(MESSAGE, { ...OPTIONS, fetchImpl: down as unknown as typeof fetch }),
    ).toBe(false);
  });
});
