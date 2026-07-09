import { afterEach, describe, expect, it, vi } from "vitest";
import type { Signal } from "@/types/pipeline";

const refreshSignals = vi.fn();
vi.mock("@/services/sillage-signals", () => ({ refreshSignals: () => refreshSignals() }));

async function callPost() {
  const { POST } = await import("./route");
  return POST();
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/signals/refresh", () => {
  it("returns the fresh signals as JSON", async () => {
    const signals: Signal[] = [{ id: "s1", company: "Acme", type: "funding", detail: "Series B" }];
    refreshSignals.mockResolvedValue(signals);

    const res = await callPost();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(signals);
  });

  it("degrades to an empty list (offline returns [])", async () => {
    refreshSignals.mockResolvedValue([]);

    const res = await callPost();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("surfaces a live Sillage error as a message with a non-2xx status", async () => {
    refreshSignals.mockRejectedValue(new Error("Sillage rate-limited (429)."));

    const res = await callPost();

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await res.json()).toEqual({ error: "Sillage rate-limited (429)." });
  });
});
