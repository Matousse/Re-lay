import { describe, expect, it } from "vitest";
import { diffWords, hasChanges } from "@/lib/diff";

function reassemble(segments: ReturnType<typeof diffWords>, side: "before" | "after"): string {
  const skip = side === "before" ? "added" : "removed";
  return segments
    .filter((segment) => segment.type !== skip)
    .map((segment) => segment.text)
    .join("");
}

describe("diffWords", () => {
  it("returns a single equal segment for identical texts", () => {
    const segments = diffWords("Hi Maxime, congrats.", "Hi Maxime, congrats.");
    expect(segments).toEqual([{ type: "equal", text: "Hi Maxime, congrats." }]);
    expect(hasChanges(segments)).toBe(false);
  });

  it("detects an added word", () => {
    const segments = diffWords("a 20-minute look", "a quick 20-minute look");
    expect(segments.filter((s) => s.type === "added")).toEqual([{ type: "added", text: "quick " }]);
    expect(segments.some((s) => s.type === "removed")).toBe(false);
  });

  it("detects a removed word", () => {
    const segments = diffWords("well deserved, truly.", "well deserved.");
    expect(hasChanges(segments)).toBe(true);
    expect(segments.some((s) => s.type === "removed")).toBe(true);
  });

  it("detects a replacement as removed + added", () => {
    const segments = diffWords("Worth a 20-minute look?", "Worth a 15-minute look?");
    expect(segments.filter((s) => s.type === "removed").map((s) => s.text)).toEqual(["20-minute"]);
    expect(segments.filter((s) => s.type === "added").map((s) => s.text)).toEqual(["15-minute"]);
  });

  it("handles empty inputs", () => {
    expect(diffWords("", "")).toEqual([]);
    expect(diffWords("", "hello")).toEqual([{ type: "added", text: "hello" }]);
    expect(diffWords("hello", "")).toEqual([{ type: "removed", text: "hello" }]);
  });

  it("reassembles both sides verbatim, including line breaks", () => {
    const before = "Hi Thomas,\n\nCongrats on the new role.\nBest,";
    const after = "Hi Thomas,\n\nHuge congrats on the new role at Kerneos.\nBest,";
    const segments = diffWords(before, after);
    expect(reassemble(segments, "before")).toBe(before);
    expect(reassemble(segments, "after")).toBe(after);
  });
});
