import { AccountSchema, HumanDecisionSchema, OutreachDraftSchema } from "@/types/pipeline";

it("parse un compte perdu valide", () => {
  const account = AccountSchema.parse({
    id: "acc_1",
    company: "Acme",
    status: "lost",
    lossReason: "budget",
    lostAt: "2024-03-10",
    notes: [{ date: "2024-03-01", author: "Sam", text: "CMO juge l'outil trop cher" }],
  });
  expect(account.status).toBe("lost");
});

it("rejette une décision humaine inconnue", () => {
  expect(() => HumanDecisionSchema.parse({ type: "maybe" })).toThrow();
});

it("exige un sujet et un corps pour un brouillon", () => {
  expect(() => OutreachDraftSchema.parse({ subject: "", body: "", rationale: "x" })).toThrow();
});
