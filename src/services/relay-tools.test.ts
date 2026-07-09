import { afterEach, describe, expect, it, vi } from "vitest";
import { getCompanyContext, resetCompanyContext } from "@/integrations/company-context";
import { resetNotificationRouting } from "@/integrations/notifications/routing";
import { defineTool, RELAY_TOOLS, runTool } from "./relay-tools";
import { z } from "zod";

const byName = (name: string) => {
  const tool = RELAY_TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`Missing tool ${name}`);
  return tool;
};

describe("runTool", () => {
  it("rejects invalid args with a uniform, model-readable message", async () => {
    const result = await runTool(byName("get_case"), {});
    expect(result.isError).toBe(true);
    expect(result.text).toContain("get_case: invalid arguments");
    expect(result.text).toContain("caseId");
  });

  it("turns a throwing handler into an isError result instead of an exception", async () => {
    const bomb = defineTool({
      name: "bomb",
      title: "Bomb",
      description: "…",
      schema: z.object({}),
      handler: async () => {
        throw new Error("kaboom");
      },
    });
    const result = await runTool(bomb, {});
    expect(result.isError).toBe(true);
    expect(result.text).toBe("bomb failed: kaboom");
  });

  it("hands parsed, typed args to the handler", async () => {
    const spy = vi.fn(async ({ n }: { n: number }) => ({ text: String(n * 2) }));
    const double = defineTool({
      name: "double",
      title: "Double",
      description: "…",
      schema: z.object({ n: z.number() }),
      handler: spy,
    });
    const result = await runTool(double, { n: 21 });
    expect(spy).toHaveBeenCalledWith({ n: 21 });
    expect(result.text).toBe("42");
  });
});

describe("RELAY_TOOLS", () => {
  afterEach(() => {
    resetCompanyContext();
    resetNotificationRouting();
  });

  it("exposes the full, uniquely named tool surface", () => {
    const names = RELAY_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([
      "connect_integrations",
      "list_signals",
      "list_revivable_deals",
      "get_case",
      "run_reengagement",
      "approve_play",
      "reject_play",
      "get_workspace_setup",
      "read_website",
      "save_company_context",
      "configure_sillage_persona",
      "create_signal_agent",
      "watch_accounts",
      "route_notifications",
    ]);
  });

  it("saves and reports the company context", async () => {
    const result = await runTool(byName("save_company_context"), {
      offering: "Data analytics for finance teams",
      icp: "CFOs and Risk leads at scale-ups",
      stakes: "Compliance deadlines and audit risk",
    });
    expect(result.isError).toBeUndefined();
    expect(result.summary).toContain("Company context saved");
    expect(getCompanyContext()?.offering).toContain("Data analytics");
  });

  it("routes notifications only with a reachable channel", async () => {
    const noChannel = await runTool(byName("route_notifications"), { name: "Sam" });
    expect(noChannel.isError).toBe(true);

    const routed = await runTool(byName("route_notifications"), {
      name: "Sam",
      slackMemberId: "U0123ABCD",
    });
    expect(routed.isError).toBeUndefined();
    expect(routed.summary).toContain("routed to Sam");
  });

  it("refuses an email override with subject but no body", async () => {
    const result = await runTool(byName("approve_play"), { caseId: "case-x", subject: "hello" });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("subject and body together");
  });

  it("reports the missing Sillage key on setup tools instead of throwing", async () => {
    // No SILLAGE_API_KEY in tests — the setup tools must degrade honestly.
    const setup = await runTool(byName("get_workspace_setup"), {});
    expect(setup.isError).toBe(true);
    expect(setup.text).toContain("SILLAGE_API_KEY");
    const agent = await runTool(byName("create_signal_agent"), {
      name: "Champion watch",
      type: "champion",
    });
    expect(agent.isError).toBe(true);
    expect(agent.text).toContain("SILLAGE_API_KEY");
  });

  it("requires keywords for keyword agent types", async () => {
    const result = await runTool(byName("create_signal_agent"), {
      name: "AI hiring",
      type: "job_posting_keyword_detection",
    });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("keyword");
  });

  it("normalizes watch_accounts domains and rejects junk", async () => {
    const junk = await runTool(byName("watch_accounts"), { domains: ["qonto,com"] });
    expect(junk.isError).toBe(true);
    expect(junk.text).toContain("qonto,com");

    // Valid after normalization ("https://www.Qonto.com/about" → "qonto.com"):
    // it passes validation and then stops on the missing key — proving the
    // domain made it through the normalizer.
    const normalized = await runTool(byName("watch_accounts"), {
      domains: ["https://www.Qonto.com/about"],
    });
    expect(normalized.isError).toBe(true);
    expect(normalized.text).toContain("SILLAGE_API_KEY");
  });

  it("lists signals as JSON the model can read, with a human summary", async () => {
    const result = await runTool(byName("list_signals"), {});
    expect(result.isError).toBeUndefined();
    // Without SILLAGE_API_KEY the source is offline and the list is empty —
    // still valid JSON plus the one-liner surfaced in the chat's step bubbles.
    const signals = JSON.parse(result.text) as { id: string }[];
    expect(Array.isArray(signals)).toBe(true);
    expect(result.summary).toMatch(/signals? found across/);
  });
});
