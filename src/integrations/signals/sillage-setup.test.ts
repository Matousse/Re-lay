import type { AxiosInstance } from "axios";
import { describe, expect, it, vi } from "vitest";
import { makeSillageSetup, SillageSetup } from "./sillage-setup";

// Asserts the exact request bodies sent to the live workspace — the write
// paths (persona, agents, accounts) are where a malformed payload turns into
// an API 400 in the middle of a demo.

function fakeHttp() {
  const get = vi.fn(async (url: string) => {
    if (url.includes("/v2/setup-state")) {
      return {
        data: {
          persona_set: true,
          list_uploaded: true,
          ingestion_complete: true,
          has_contents: false,
        },
      };
    }
    if (url.includes("/v2/agents")) {
      return {
        data: { data: [{ id: 1, name: "Champion watch", type: "champion", enabled: true }] },
      };
    }
    if (url.includes("/v2/persona")) return { data: { data: { job_title: ["CRO"] } } };
    throw new Error(`Sillage API ${url} responded 404`);
  });
  const put = vi.fn(async () => ({
    data: { data: { id: 12 }, warnings: ["location unresolved"] },
  }));
  const post = vi.fn(async (url: string) => {
    if (url.includes("/v2/agents")) {
      return {
        data: { data: { id: 9, name: "AI hiring", type: "keyword_detection", enabled: true } },
      };
    }
    return { data: {} };
  });
  return { instance: { get, put, post } as unknown as AxiosInstance, get, put, post };
}

describe("SillageSetup", () => {
  it("maps persona input onto the API's snake_case body and surfaces warnings", async () => {
    const { instance, put } = fakeHttp();
    const setup = new SillageSetup("demo-key", instance);
    const { warnings } = await setup.updatePersona({
      job_title: ["VP Sales"],
      industry: ["SaaS"],
      additional_info: "B2B scale-ups",
    });
    expect(put).toHaveBeenCalledWith("/v2/persona", {
      job_title: ["VP Sales"],
      industry: ["SaaS"],
      location: undefined,
      additional_info: "B2B scale-ups",
    });
    expect(warnings).toEqual(["location unresolved"]);
  });

  it("sends keywords for keyword agent types", async () => {
    const { instance, post } = fakeHttp();
    const setup = new SillageSetup("demo-key", instance);
    await setup.createAgent({ name: "AI hiring", type: "keyword_detection", keywords: ["AI"] });
    expect(post).toHaveBeenCalledWith("/v2/agents", {
      name: "AI hiring",
      type: "keyword_detection",
      parameters: { tracking_keywords: ["AI"] },
    });
  });

  it("strips keywords for relationship agent types (the API rejects them)", async () => {
    const { instance, post } = fakeHttp();
    const setup = new SillageSetup("demo-key", instance);
    // Even if a caller passes keywords with a champion agent, parameters are
    // decided by the TYPE.
    await setup.createAgent({ name: "Champion watch", type: "champion", keywords: ["noise"] });
    expect(post).toHaveBeenCalledWith("/v2/agents", {
      name: "Champion watch",
      type: "champion",
      parameters: {},
    });
  });

  it("adds accounts as {domain} entries", async () => {
    const { instance, post } = fakeHttp();
    const setup = new SillageSetup("demo-key", instance);
    const count = await setup.addAccounts(["qonto.com", "acme.com"]);
    expect(count).toBe(2);
    expect(post).toHaveBeenCalledWith("/v2/top-account-list/accounts", {
      accounts: [{ domain: "qonto.com" }, { domain: "acme.com" }],
    });
  });

  it("parses the setup state and agent list", async () => {
    const { instance } = fakeHttp();
    const setup = new SillageSetup("demo-key", instance);
    expect((await setup.getSetupState()).persona_set).toBe(true);
    expect(await setup.listAgents()).toEqual([
      { id: 1, name: "Champion watch", type: "champion", enabled: true },
    ]);
  });
});

describe("makeSillageSetup", () => {
  it("returns null without a key so tools can report it honestly", () => {
    expect(makeSillageSetup(undefined)).toBeNull();
    expect(makeSillageSetup("demo-key")).toBeInstanceOf(SillageSetup);
  });
});
