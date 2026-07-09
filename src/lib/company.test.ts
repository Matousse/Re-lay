import { describe, expect, it } from "vitest";
import { normalizeCompanyName } from "@/lib/company";

describe("normalizeCompanyName", () => {
  it("lowercases and strips accents and punctuation", () => {
    expect(normalizeCompanyName("Éléphant, Inc.")).toBe("elephant");
    expect(normalizeCompanyName("QONTO")).toBe("qonto");
  });

  it("drops trailing legal suffixes but keeps brand words", () => {
    expect(normalizeCompanyName("Qonto SAS")).toBe("qonto");
    expect(normalizeCompanyName("Acme Inc")).toBe("acme");
    expect(normalizeCompanyName("Toundra Studio")).toBe("toundra studio");
    // A leading entity word is the brand, not a suffix, and must survive.
    expect(normalizeCompanyName("SAS Institute")).toBe("sas institute");
  });

  it("expands & and collapses whitespace", () => {
    expect(normalizeCompanyName("  Dupont  &  Fils  ")).toBe("dupont and fils");
  });

  it("returns empty for blank input", () => {
    expect(normalizeCompanyName("   ")).toBe("");
  });
});
