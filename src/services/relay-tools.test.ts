import { describe, expect, it } from "vitest";
import { RELAY_TOOLS } from "./relay-tools";

const byName = (name: string) => {
  const tool = RELAY_TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`Missing tool ${name}`);
  return tool;
};

describe("RELAY_TOOLS", () => {
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
    ]);
  });

  it("rejects malformed args at the tool boundary instead of throwing", async () => {
    const result = await byName("get_case").handler({});
    expect(result.isError).toBe(true);
    expect(result.text).toContain("caseId");
  });

  it("refuses an email override with subject but no body", async () => {
    const result = await byName("approve_play").handler({ caseId: "case-x", subject: "hello" });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("subject and body together");
  });

  it("lists signals as JSON the model can read, with a human summary", async () => {
    const result = await byName("list_signals").handler({});
    expect(result.isError).toBeUndefined();
    // Without SILLAGE_API_KEY the source is offline and the list is empty —
    // still valid JSON plus the one-liner surfaced in the chat's step bubbles.
    const signals = JSON.parse(result.text) as { id: string }[];
    expect(Array.isArray(signals)).toBe(true);
    expect(result.summary).toMatch(/signals? found across/);
  });
});
