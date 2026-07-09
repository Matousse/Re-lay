import { FakeCrm } from "@/integrations/crm/fake";

it("trouve un compte perdu par entreprise", async () => {
  const crm = new FakeCrm();
  const account = await crm.findAccountByCompany("Acme");
  expect(account?.status).toBe("lost");
  expect(account?.notes.length).toBeGreaterThan(0);
});

it("renvoie null pour une entreprise inconnue", async () => {
  const crm = new FakeCrm();
  expect(await crm.findAccountByCompany("Nope")).toBeNull();
});

it("enregistre contact et note en écriture", async () => {
  const crm = new FakeCrm();
  await crm.writeNote("acc_1", "relance envoyée");
  expect(crm.writtenNotes).toContainEqual({ accountId: "acc_1", text: "relance envoyée" });
});

it("liste uniquement les comptes perdus qui portent un domaine", async () => {
  const crm = new FakeCrm();
  const accounts = await crm.listClosedLostAccounts();

  // Acme/Qonto sont perdus mais sans domaine → exclus ; Globex est actif → exclu.
  expect(accounts.every((account) => account.domain.length > 0)).toBe(true);
  expect(accounts.map((account) => account.company)).not.toContain("Acme");
  expect(accounts.map((account) => account.company)).not.toContain("Globex");

  const kerneos = accounts.find((account) => account.company === "Kerneos Analytics");
  expect(kerneos?.domain).toBe("kerneos.io");
  expect(kerneos?.contacts[0]).toEqual({
    name: "Claire Fontaine",
    jobTitle: "CMO",
    location: "France",
  });
});
