import axios, { type AxiosInstance } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeEnrichment } from "@/integrations/enrichment/fake";
import { FullEnrichEnrichment, makeEnrichment } from "@/integrations/enrichment/fullenrich";

// Mirrors the FullEnrich API v2 result shape: GET /contact/enrich/bulk/{id}
// returns a top-level status plus data[].contact_info.work_emails / .phones.
const FINISHED = {
  status: "FINISHED",
  data: [
    {
      contact_info: {
        work_emails: [{ email: "lea.blanc@acme.com", status: "DELIVERABLE" }],
        phones: [{ number: "+33 6 11 22 33 44", region: "FR" }],
      },
    },
  ],
};

// Stands in for the injected AxiosInstance: POST starts the batch and returns an
// id, GET returns whatever result the test wants to observe.
function fakeHttp(getResult: unknown) {
  return {
    post: vi.fn(async () => ({ data: { enrichment_id: "enr-1" } })),
    get: vi.fn(async () => ({ data: getResult })),
    interceptors: { response: { use: vi.fn() } },
  } as unknown as AxiosInstance;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FullEnrichEnrichment", () => {
  it("maps a finished enrichment to the verified email and phone", async () => {
    const enrichment = new FullEnrichEnrichment("demo-key", fakeHttp(FINISHED));
    const contact = await enrichment.enrich({
      company: "Acme",
      personName: "Lea Blanc",
      personRole: "CMO",
    });

    expect(contact).toEqual({
      name: "Lea Blanc",
      role: "CMO",
      email: "lea.blanc@acme.com",
      mobile: "+33 6 11 22 33 44",
      location: "FR",
    });
  });

  it("posts the split name and company for a one-contact batch", async () => {
    const http = fakeHttp(FINISHED);
    await new FullEnrichEnrichment("demo-key", http).enrich({
      company: "Acme",
      personName: "Lea Marie Blanc",
    });

    expect(http.post).toHaveBeenCalledWith(
      "/contact/enrich/bulk",
      expect.objectContaining({
        data: [
          expect.objectContaining({
            first_name: "Lea",
            last_name: "Marie Blanc",
            company_name: "Acme",
            enrich_fields: ["contact.work_emails", "contact.phones"],
          }),
        ],
      }),
    );
  });

  it("falls back without calling the API when there is no person to enrich", async () => {
    const http = fakeHttp(FINISHED);
    const contact = await new FullEnrichEnrichment("demo-key", http).enrich({ company: "Acme" });

    expect(http.post).not.toHaveBeenCalled();
    expect(contact.name).toBe("Nouveau Décideur");
    expect(contact.email).toContain("@acme.com");
  });

  it("falls back on a terminal failure status", async () => {
    const http = fakeHttp({ status: "CREDITS_INSUFFICIENT", data: [] });
    const contact = await new FullEnrichEnrichment("demo-key", http).enrich({
      company: "Acme",
      personName: "Lea Blanc",
    });

    expect(contact.email).toBe("lea.blanc@acme.com"); // synthesized by the fallback
  });

  it("falls back when the batch finishes without a verified email", async () => {
    const http = fakeHttp({ status: "FINISHED", data: [{ contact_info: { work_emails: [] } }] });
    const contact = await new FullEnrichEnrichment("demo-key", http).enrich({
      company: "Acme",
      personName: "Lea Blanc",
    });

    expect(contact.email).toBe("lea.blanc@acme.com"); // synthesized by the fallback
  });

  it("builds the axios instance with the bearer key and the real host", () => {
    const createSpy = vi.spyOn(axios, "create");
    new FullEnrichEnrichment("demo-key");

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://app.fullenrich.com/api/v2",
        headers: expect.objectContaining({ Authorization: "Bearer demo-key" }),
      }),
    );
  });
});

describe("makeEnrichment", () => {
  it("returns the real adapter when a key is present, the fake otherwise", () => {
    expect(makeEnrichment("demo-key")).toBeInstanceOf(FullEnrichEnrichment);
    expect(makeEnrichment(undefined)).toBeInstanceOf(FakeEnrichment);
  });
});
