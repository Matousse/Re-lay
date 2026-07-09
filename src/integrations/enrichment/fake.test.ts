import { FakeEnrichment } from "@/integrations/enrichment/fake";

it("renvoie un contact enrichi plausible", async () => {
  const contact = await new FakeEnrichment().enrich({
    company: "Acme",
    personName: "Lea Blanc",
    personRole: "CMO",
  });
  expect(contact.email).toContain("@");
  expect(contact.name).toBe("Lea Blanc");
});
