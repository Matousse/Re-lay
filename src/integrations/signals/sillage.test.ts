import axios, { type AxiosInstance } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeSignalSource, SillageSignalSource } from "@/integrations/signals/sillage";

// Fixtures mirror the real Sillage API v1 shape: GET /workspace/signals returns
// each detection with its `signal` plus the `lead` and their `current_company`
// embedded inline (offset-paginated via meta.pagination).
const SIGNALS = {
  data: [
    {
      signal: {
        id: "s1",
        signal_type: "new_job",
        signal_date: "2026-06-12T10:30:00.000Z",
        detection_date: "2026-06-12T11:00:00.000Z",
        data: {},
      },
      lead: {
        first_name: "Lea",
        last_name: "Blanc",
        position: "CMO",
        current_company: { name: "Acme" },
      },
    },
    {
      signal: {
        id: "s2",
        signal_type: "keyword_detection",
        data: { keywords_found: ["levée de fonds", "Series B"] },
      },
      lead: { current_company: { name: "Globex" } },
    },
    {
      signal: {
        id: "s3",
        signal_type: "keyword_detection",
        data: { keywords_found: ["productivité"] },
      },
      lead: { current_company: { name: "Globex" } },
    },
    {
      signal: {
        id: "s4",
        signal_type: "job_posting_keyword_detection",
        data: { keywords_found: ["AI"], posting: { title: "Revenue Operations Manager" } },
      },
      lead: {
        first_name: "Sam",
        last_name: "Nord",
        position: "Talent",
        current_company: { name: "Initech" },
      },
    },
    {
      signal: { id: "s5", signal_type: "linkedin_comment", data: {} },
      lead: { current_company: { name: "Acme" } },
    },
    {
      // No resolvable company → dropped, whatever the type.
      signal: { id: "s6", signal_type: "new_job", data: {} },
      lead: { first_name: "Nemo", last_name: "Void", current_company: null },
    },
  ],
  meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: 6 } },
};

// Stands in for the injected AxiosInstance: get resolves { data } the way axios
// does, routing by URL exactly as the real endpoint would.
function fakeHttp() {
  const respond = async (url: string) => {
    if (url.includes("/v1/workspace/signals")) return { data: SIGNALS };
    throw new Error(`Sillage API ${url} responded 404`);
  };
  return {
    get: vi.fn((url: string) => respond(url)),
    interceptors: { response: { use: vi.fn() } },
  } as unknown as AxiosInstance;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SillageSignalSource", () => {
  it("maps new_job detections from the embedded lead and company", async () => {
    const source = new SillageSignalSource("demo-key-ok", fakeHttp());
    const signals = await source.list();

    const newJob = signals.find((s) => s.id === "slg-s1");
    expect(newJob).toEqual({
      id: "slg-s1",
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

    const funding = signals.find((s) => s.id === "slg-s2");
    expect(funding?.type).toBe("funding");
    expect(funding?.company).toBe("Globex");
    expect(signals.find((s) => s.id === "slg-s3")).toBeUndefined();
  });

  it("maps job postings and skips types (or leads) Re:lay cannot act on", async () => {
    const source = new SillageSignalSource("demo-key-ok", fakeHttp());
    const signals = await source.list();

    const posting = signals.find((s) => s.id === "slg-s4");
    expect(posting?.type).toBe("job_posting");
    expect(posting?.company).toBe("Initech");
    expect(posting?.detail).toContain("Revenue Operations Manager");
    // linkedin_comment is not actionable; s6 has no company.
    expect(signals.find((s) => s.id === "slg-s5")).toBeUndefined();
    expect(signals.find((s) => s.id === "slg-s6")).toBeUndefined();
    expect(signals).toHaveLength(3);
  });

  it("fetches a single detection by prefixed id", async () => {
    const source = new SillageSignalSource("demo-key-ok", fakeHttp());
    const signal = await source.getById("slg-s1");
    expect(signal?.company).toBe("Acme");
    expect(await source.getById("s1")).toBeNull();
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
  it("returns the real source with a key, an empty offline source without", async () => {
    expect(makeSignalSource("demo-key-ok")).toBeInstanceOf(SillageSignalSource);

    const offline = makeSignalSource(undefined);
    expect(offline).not.toBeInstanceOf(SillageSignalSource);
    expect(await offline.list()).toEqual([]);
    expect(await offline.getById("slg-anything")).toBeNull();
  });
});
