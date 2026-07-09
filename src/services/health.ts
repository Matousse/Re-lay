import { env } from "@/lib/env";
import { verifyHubSpotConnection } from "@/integrations/crm/hubspot";

// "live" = a real HUBSPOT_ACCESS_TOKEN is set and we hit the API; "fake" = no
// token, the app runs on the seeded FakeCrm. `connected` reflects the actual
// probe result (a live token can still be invalid/expired).
export type HubSpotHealth = {
  mode: "live" | "fake";
  connected: boolean;
  companies?: number;
  closedLost?: number;
  contacts?: number;
  detail: string;
};

export async function getHubSpotHealth(): Promise<HubSpotHealth> {
  const token = env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return {
      mode: "fake",
      connected: false,
      detail: "Demo mode — running on the seeded FakeCrm (no HUBSPOT_ACCESS_TOKEN).",
    };
  }

  const result = await verifyHubSpotConnection(token);
  if (!result.ok) {
    return { mode: "live", connected: false, detail: result.error };
  }
  return {
    mode: "live",
    connected: true,
    companies: result.companies,
    closedLost: result.closedLost,
    contacts: result.contacts,
    detail: `${result.companies} companies · ${result.closedLost} closed-lost`,
  };
}
