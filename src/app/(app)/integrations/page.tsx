import type { Metadata } from "next";
import Image from "next/image";
import { Plug } from "lucide-react";
import { ConnectDialog } from "@/components/connectors/connect-dialog";
import { RefreshHubspotButton } from "@/components/connectors/refresh-hubspot-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CONNECTOR_LOGOS } from "@/lib/logos";
import { ENTER, enterDelay } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { getConnectorStates } from "@/services/connectors";
import { getHubSpotHealth } from "@/services/health";
import type { ConnectorId } from "@/types/connectors";

export const metadata: Metadata = {
  title: "Integrations — Re:lay",
};

// The HubSpot card runs a live probe on every render; never serve it from a
// stale cache, or a deleted contact/company would linger.
export const dynamic = "force-dynamic";

const INTEGRATIONS: {
  id: ConnectorId;
  name: string;
  role: string;
  description: string;
  detail: string;
  lastSync: string;
  successDetail: string;
}[] = [
  {
    id: "sillage",
    name: "Sillage",
    role: "Signal engine",
    description:
      "Streams buying signals in real time: people moves, funding rounds, competitor issues, hiring surges.",
    detail: "Watching 214 closed-lost accounts",
    lastSync: "Live — last event 2 min ago",
    successDetail: "214 closed-lost accounts are now being watched for signals.",
  },
  {
    id: "fullenrich",
    name: "FullEnrich",
    role: "Contact enrichment",
    description:
      "Waterfall enrichment across 20+ data providers to find verified emails and mobile numbers for new decision-makers.",
    detail: "97% match rate this month",
    lastSync: "Last enrichment 12 min ago",
    successDetail: "Waterfall enrichment is ready across 20+ providers.",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    role: "CRM",
    description:
      "Source of closed-lost opportunities and their history; approved plays sync back as contacts, notes and tasks.",
    detail: "1,842 opportunities · 312 closed-lost",
    lastSync: "Synced 5 min ago",
    successDetail: "1,842 opportunities imported, 312 closed-lost indexed.",
  },
];

export default async function IntegrationsPage() {
  const [states, hubspotHealth] = await Promise.all([getConnectorStates(), getHubSpotHealth()]);
  // HubSpot shows real numbers when a token is live; with no token it stays in
  // pure demo mode (the mocked story below). Either/or — never a mix.
  const hubspotLive = hubspotHealth.mode === "live";

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className={`mb-8 ${ENTER}`}>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Re:lay sits on top of your existing stack — signals in, plays out.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {INTEGRATIONS.map((integration, index) => {
          // For HubSpot with a live token, the badge reflects the real probe;
          // otherwise it's the mocked connector toggle.
          const liveHubspot = integration.id === "hubspot" && hubspotLive;
          const connected = liveHubspot ? hubspotHealth.connected : states[integration.id];
          return (
            <Card
              key={integration.name}
              className={cn(
                "group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
                !connected && "border-dashed border-amber-600/40",
                ENTER,
              )}
              style={enterDelay(index + 1)}
            >
              <CardHeader>
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={cn(
                      "relative flex size-9 items-center justify-center rounded-lg border bg-white shadow-sm transition-all duration-300 group-hover:scale-110",
                      !connected && "border-amber-600/40",
                    )}
                  >
                    <Image src={CONNECTOR_LOGOS[integration.id]} alt="" width={20} height={20} />
                    {!connected && (
                      <span className="absolute -top-1 -right-1 flex size-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:animate-none" />
                        <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
                      </span>
                    )}
                  </span>
                  {connected ? (
                    <Badge
                      variant="secondary"
                      className="bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400"
                    >
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />
                        <span className="relative inline-flex size-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                      </span>
                      Connected
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="bg-amber-600/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400"
                    >
                      <Plug aria-hidden />
                      Not connected
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base">{integration.name}</CardTitle>
                <CardDescription>{integration.role}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">{integration.description}</p>
                <div className="border-t pt-3">
                  {liveHubspot && hubspotHealth.connected ? (
                    <div className="space-y-2">
                      <p className="font-medium">
                        {hubspotHealth.companies} companies · {hubspotHealth.closedLost} closed-lost
                        · {hubspotHealth.contacts} contacts
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-muted-foreground text-xs">
                          Live portal · checked just now
                        </p>
                        <RefreshHubspotButton />
                      </div>
                    </div>
                  ) : liveHubspot ? (
                    <div className="space-y-2">
                      <p className="font-medium text-red-600 dark:text-red-400">
                        Token invalid or expired
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-muted-foreground text-xs">{hubspotHealth.detail}</p>
                        <RefreshHubspotButton />
                      </div>
                    </div>
                  ) : connected ? (
                    <>
                      <p className="font-medium">{integration.detail}</p>
                      <p className="text-muted-foreground text-xs">{integration.lastSync}</p>
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-muted-foreground text-xs">
                        Connect to bring Re:lay online.
                      </p>
                      <ConnectDialog
                        id={integration.id}
                        name={integration.name}
                        successDetail={integration.successDetail}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
