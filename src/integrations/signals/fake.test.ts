import { FakeSignalSource } from "@/integrations/signals/fake";

it("récupère un signal par id", async () => {
  const sig = await new FakeSignalSource().getById("sig_1");
  expect(sig?.company).toBe("Acme");
  expect(sig?.type).toBe("new_decision_maker");
});
