import { env } from "@/lib/env";
import { FakeCrm } from "@/integrations/crm/fake";
import { HubSpotCrm } from "@/integrations/crm/hubspot";
import type { CrmPort } from "@/integrations/crm/port";

// Real HubSpot portal when HUBSPOT_ACCESS_TOKEN is set, seeded FakeCrm
// otherwise — same light-up-on-key pattern as makeAnthropicClient /
// makeSignalSource, so the demo runs fully offline out of the box.
export function makeCrm(): CrmPort {
  const token = env.HUBSPOT_ACCESS_TOKEN;
  return token ? new HubSpotCrm(token) : new FakeCrm();
}
