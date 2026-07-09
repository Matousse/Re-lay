import { describe, expect, it, vi } from "vitest";
import type { LlmClient } from "@/integrations/llm/client";
import { analyzeCompanyWebsite } from "./onboarding";

const HTML = `<html><head><style>p{}</style></head><body>
<script>evil()</script><h1>Acme</h1><p>Analytics for finance teams.</p></body></html>`;

const htmlFetch = vi.fn(
  async (_url: RequestInfo | URL, _init?: RequestInit) =>
    new Response(HTML, { status: 200, headers: { "Content-Type": "text/html" } }),
) as unknown as typeof fetch;

function fakeLlm(behavior: "ok" | "throws"): LlmClient {
  return {
    structured: vi.fn(async ({ user }: { user: string }) => {
      if (behavior === "throws") throw new Error("overloaded");
      // The stripped page text must reach the model.
      expect(user).toContain("Analytics for finance teams");
      expect(user).not.toContain("<script>");
      return {
        companyName: "Acme",
        offering: "Analytics for finance teams",
        icp: "CFOs",
        stakes: "Audit risk",
      };
    }) as LlmClient["structured"],
  };
}

describe("analyzeCompanyWebsite", () => {
  it("reads the site, strips markup and returns the model's draft", async () => {
    const result = await analyzeCompanyWebsite("https://acme.com", {
      llm: fakeLlm("ok"),
      fetchImpl: htmlFetch,
    });
    expect(result).toMatchObject({ ok: true, draft: { offering: "Analytics for finance teams" } });
  });

  it("degrades to a reason when the model fails — never a throw", async () => {
    const result = await analyzeCompanyWebsite("https://acme.com", {
      llm: fakeLlm("throws"),
      fetchImpl: htmlFetch,
    });
    expect(result).toEqual({
      ok: false,
      reason: "The model couldn't analyze the site — try again in a moment.",
    });
  });

  it("degrades to a reason when the site is unreachable", async () => {
    const notFound = vi.fn(
      async () => new Response(null, { status: 404 }),
    ) as unknown as typeof fetch;
    const result = await analyzeCompanyWebsite("https://acme.com", {
      llm: fakeLlm("ok"),
      fetchImpl: notFound,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("404");
  });

  it("refuses private hosts before any request goes out (SSRF guard)", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    for (const url of [
      "http://localhost:3000/api/env",
      "http://127.0.0.1/secrets",
      "http://10.0.0.1/",
      "http://172.16.0.1/",
      "http://192.168.1.1/",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]/",
    ]) {
      const result = await analyzeCompanyWebsite(url, { llm: fakeLlm("ok"), fetchImpl });
      expect(result.ok).toBe(false);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("asks for the key when no LLM is available", async () => {
    // No ANTHROPIC_API_KEY in tests and no injected llm.
    const result = await analyzeCompanyWebsite("https://acme.com", { fetchImpl: htmlFetch });
    expect(result).toEqual({ ok: false, reason: "Add ANTHROPIC_API_KEY to analyze a website." });
  });
});
