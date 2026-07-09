import { beforeEach, describe, expect, it } from "vitest";
import {
  allConnected,
  connectConnector,
  getConnectorStates,
  missingConnectors,
} from "@/services/connectors";
import {
  getStats,
  listCases,
  resetDemoState,
  simulateIncomingSignal,
} from "@/services/reengagement";

beforeEach(async () => {
  await resetDemoState();
});

describe("connector states", () => {
  it("boots the demo with Sillage disconnected and the rest connected", async () => {
    expect(await getConnectorStates()).toEqual({
      sillage: false,
      fullenrich: true,
      hubspot: true,
    });
    expect(await allConnected()).toBe(false);
    expect(await missingConnectors()).toEqual([{ id: "sillage", name: "Sillage" }]);
  });

  it("connects a connector and reports the stack online", async () => {
    await connectConnector("sillage");
    expect(await allConnected()).toBe(true);
    expect(await missingConnectors()).toEqual([]);
  });

  it("restores the disconnected state on demo reset", async () => {
    await connectConnector("sillage");
    await resetDemoState();
    expect(await allConnected()).toBe(false);
  });
});

describe("pipeline gating", () => {
  it("produces nothing while the stack is offline", async () => {
    expect(await listCases()).toEqual([]);
    expect(await getStats()).toEqual({
      signalsMatched: 0,
      goVerdicts: 0,
      pendingReview: 0,
      revivablePipeline: 0,
    });
    expect(await simulateIncomingSignal()).toBeNull();
  });

  it("comes online once every connector is linked", async () => {
    await connectConnector("sillage");
    expect((await listCases()).length).toBeGreaterThan(0);
    expect((await getStats()).revivablePipeline).toBeGreaterThan(0);
    expect(await simulateIncomingSignal()).not.toBeNull();
  });
});
