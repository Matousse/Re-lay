import { makeQualifyNode, routeOnStatus } from "@/services/pipeline/nodes/qualify";
import { FakeCrm } from "@/integrations/crm/fake";

const signal = { id: "s", company: "Acme", type: "new_decision_maker" as const, detail: "" };

it("charge le compte perdu et route vers analyst", async () => {
  const node = makeQualifyNode(new FakeCrm());
  const patch = await node({ signal } as never);
  expect(patch.account?.status).toBe("lost");
  expect(routeOnStatus({ ...patch, signal } as never)).toBe("analyst");
});

it("route vers END si le compte est actif", async () => {
  const node = makeQualifyNode(new FakeCrm());
  const patch = await node({ signal: { ...signal, company: "Globex" } } as never);
  expect(routeOnStatus({ ...patch, signal } as never)).toBe("__end__");
});
