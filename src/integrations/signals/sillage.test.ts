import axios, { type AxiosInstance } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeSignalSource } from "@/integrations/signals/fake";
import { makeSignalSource, SillageSignalSource } from "@/integrations/signals/sillage";

// Fixtures mirror the shapes published in the Sillage OpenAPI spec
// (api.getsillage.com/api/v1/docs/spec).
const DETECTIONS = {
  data: [
    {
      id: 101,
      signal_type: "newJob",
      data: {
        previous_position: { role: "Head of Marketing", company_name: "OldCo" },
        new_position: { role: "CMO", company_name: "Acme", start_date: "2026-06-01" },
      },
      signal_date: "2026-06-12T10:30:00.000Z",
      lead_id: 7,
      company_id: 42,
      agent_id: 3,
    },
    {
      id: 102,
      signal_type: "keywordDetection",
      data: { content_id: 555, author: null, keywords_found: ["levée de fonds", "Series B"] },
      lead_id: null,
      company_id: 43,
    },
    {
      id: 103,
      signal_type: "keywordDetection",
      data: { content_id: 556, author: null, keywords_found: ["productivité"] },
      lead_id: null,
      company_id: 43,
    },
    {
      id: 104,
      signal_type: "jobPosting",
      data: {
        posting: { title: "Revenue Operations Manager", company_name: "Initech" },
        job_title: null,
      },
      lead_id: null,
      company_id: null,
    },
    {
      id: 105,
      signal_type: "contentEngagement",
      data: {},
      lead_id: null,
      company_id: 42,
    },
  ],
  meta: { next_cursor: null, has_more: false },
};

const LEADS = {
  data: [
    {
      id: "7",
      firstName: "Lea",
      lastName: "Blanc",
      position: "CMO",
      company: { name: "Acme" },
      email: null,
      phoneNumber: null,
    },
  ],
  meta: {},
};

const TOP_ACCOUNTS = {
  data: [
    { id: 42, name: "Acme", domain: "acme.com" },
    { id: 43, name: "Globex", domain: "globex.com" },
  ],
  meta: { limit: 250 },
};

// Routes a request path onto the fixture the real API would return, mirroring
// the previous fakeFetch() router.
function payloadForPath(path: string) {
  if (path.includes("/signals/query")) return DETECTIONS;
  if (path.includes("/signals/101")) return { data: DETECTIONS.data[0] };
  if (path.includes("/leads")) return LEADS;
  if (path.includes("/top-accounts")) return TOP_ACCOUNTS;
  return null;
}

// Stands in for the injected AxiosInstance: get/post resolve { data } the way
// axios does, routing by URL exactly as the real endpoints would.
function fakeHttp() {
  const respond = async (url: string) => {
    const payload = payloadForPath(url);
    if (!payload) throw new Error(`Sillage API ${url} responded 404`);
    return { data: payload };
  };
  return {
    get: vi.fn((url: string) => respond(url)),
    post: vi.fn((url: string) => respond(url)),
    interceptors: { response: { use: vi.fn() } },
  } as unknown as AxiosInstance;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SillageSignalSource", () => {
  it("maps newJob detections with lead and company resolution", async () => {
    const source = new SillageSignalSource("demo-key-ok", fakeHttp());
    const signals = await source.list();

    const newJob = signals.find((s) => s.id === "slg-101");
    expect(newJob).toEqual({
      id: "slg-101",
      company: "Acme",
      type: "new_decision_maker",
      detail: "Lea Blanc arrive comme CMO chez Acme",
      personName: "Lea Blanc",
      personRole: "CMO",
    });
  });

  it("classifies funding keywords, skips other keyword detections", async () => {
    const source = new SillageSignalSource("demo-key-ok", fakeHttp());
    const signals = await source.list();

    const funding = signals.find((s) => s.id === "slg-102");
    expect(funding?.type).toBe("funding");
    expect(funding?.company).toBe("Globex");
    expect(signals.find((s) => s.id === "slg-103")).toBeUndefined();
  });

  it("maps job postings using the payload company and skips unknown types", async () => {
    const source = new SillageSignalSource("demo-key-ok", fakeHttp());
    const signals = await source.list();

    const posting = signals.find((s) => s.id === "slg-104");
    expect(posting?.type).toBe("job_posting");
    expect(posting?.company).toBe("Initech");
    expect(posting?.detail).toContain("Revenue Operations Manager");
    // contentEngagement is not something Re:lay knows how to act on.
    expect(signals.find((s) => s.id === "slg-105")).toBeUndefined();
    expect(signals).toHaveLength(3);
  });

  it("fetches a single detection by prefixed id", async () => {
    const source = new SillageSignalSource("demo-key-ok", fakeHttp());
    const signal = await source.getById("slg-101");
    expect(signal?.company).toBe("Acme");
    expect(await source.getById("sig_1")).toBeNull();
  });

  it("builds the axios instance with the bearer key and the real host", () => {
    const createSpy = vi.spyOn(axios, "create");
    // Instantiate without an injected instance so the default one is created.
    new SillageSignalSource("demo-key-ok");

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://api.getsillage.com/api",
        headers: expect.objectContaining({ Authorization: "Bearer demo-key-ok" }),
      }),
    );
  });

  it("throws a readable, path-aware error on non-2xx responses", async () => {
    // A real axios instance whose adapter always 401s, so the production
    // response interceptor the source registers is what rewrites the error.
    const http = axios.create({ baseURL: "https://api.getsillage.com/api" });
    http.defaults.adapter = async (config) => {
      throw new axios.AxiosError(
        "Request failed with status code 401",
        "ERR_BAD_REQUEST",
        config,
        undefined,
        { status: 401, data: null, statusText: "Unauthorized", headers: {}, config } as never,
      );
    };

    const source = new SillageSignalSource("demo-key-bad", http);
    await expect(source.list()).rejects.toThrow(/responded 401/);
  });
});

describe("makeSignalSource", () => {
  it("returns the real source when a key is provided, the fake otherwise", () => {
    expect(makeSignalSource("demo-key-ok")).toBeInstanceOf(SillageSignalSource);
    expect(makeSignalSource(undefined)).toBeInstanceOf(FakeSignalSource);
  });
});
