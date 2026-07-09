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
