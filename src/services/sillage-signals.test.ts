import { describe, expect, it, vi } from "vitest";
import { SillageOfflineError, type SillageWriteClient } from "@/integrations/signals/sillage-write";
import { refreshSignals } from "@/services/sillage-signals";
import type { Signal } from "@/types/pipeline";

const SIGNALS: Signal[] = [{ id: "s1", company: "Acme", type: "funding", detail: "Series B" }];

// Only the write method refreshSignals drives; the rest throw so a stray call is
// caught by the test rather than silently succeeding.
function fakeSillage(runAllAgents: SillageWriteClient["runAllAgents"]): SillageWriteClient {
  const unused = () => {
    throw new Error("unexpected call");
  };
  return {
    runAllAgents,
    addTargetAccounts: unused,
    countTargetAccounts: unused,
    getPersona: unused,
    setPersona: unused,
    listAgents: unused,
    createAgent: unused,
    updateAgent: unused,
    launchSignalRun: unused,
  } as unknown as SillageWriteClient;
}

describe("refreshSignals", () => {
  it("triggers the agents, then lists the fresh detections", async () => {
    const order: string[] = [];
    const runAllAgents = vi.fn(async () => {
      order.push("run");
      return { agents: 3, runs: 3 };
    });
    const listSignals = vi.fn(async () => {
      order.push("list");
      return SIGNALS;
    });

    const result = await refreshSignals({ sillage: fakeSillage(runAllAgents), listSignals });

    expect(result).toEqual(SIGNALS);
    expect(runAllAgents).toHaveBeenCalledOnce();
    expect(order).toEqual(["run", "list"]); // trigger before read
  });

  it("degrades to an empty list when Sillage is offline (no key)", async () => {
    const runAllAgents = vi.fn(async () => {
      throw new SillageOfflineError("no key");
    });
    const listSignals = vi.fn(async () => SIGNALS);

    const result = await refreshSignals({ sillage: fakeSillage(runAllAgents), listSignals });

    expect(result).toEqual([]);
    expect(listSignals).not.toHaveBeenCalled();
  });

  it("propagates a live Sillage error (e.g. rate-limit) so the route can surface it", async () => {
    const runAllAgents = vi.fn(async () => {
      throw new Error("Sillage rate-limited (429).");
    });

    await expect(
      refreshSignals({ sillage: fakeSillage(runAllAgents), listSignals: async () => SIGNALS }),
    ).rejects.toThrow(/rate-limited/);
  });
});
