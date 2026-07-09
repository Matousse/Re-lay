import type { Metadata } from "next";
import Image from "next/image";
import { KeyRound, Plug, Sparkles } from "lucide-react";
import { ConnectDialog } from "@/components/connectors/connect-dialog";
import { RefreshHubspotButton } from "@/components/connectors/refresh-hubspot-button";
import { SillageConnectDialog } from "@/components/connectors/sillage-connect-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CONNECTOR_LOGOS, PLATFORM_LOGOS } from "@/lib/logos";
import { ENTER, enterDelay } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  getConnectorStates,
  platformIntegrations,
  type PlatformIntegration,
} from "@/services/connectors";
import { getHubSpotHealth, type HubSpotHealth } from "@/services/health";
import type { ConnectorStates } from "@/types/connectors";

export const metadata: Metadata = {
  title: "Integrations — Re:lay",
};

// The HubSpot card runs a live probe on every render; never serve it from a
// stale cache, or a deleted contact/company would linger.
export const dynamic = "force-dynamic";

type Connector = {
  id: "sillage" | "fullenrich" | "hubspot";
  name: string;
  role: string;
  description: string;
  detail: string;
  lastSync: string;
  successDetail: string;
};

const CONNECTORS: Record<Connector["id"], Connector> = {
  sillage: {
    id: "sillage",
    name: "Sillage",
    role: "Signal engine",
    description:
      "Streams buying signals in real time: people moves, funding rounds, competitor issues, hiring surges.",
    detail: "Watching 214 closed-lost accounts",
    lastSync: "Live — last event 2 min ago",
    successDetail: "214 closed-lost accounts are now being watched for signals.",
  },
  fullenrich: {
    id: "fullenrich",
    name: "FullEnrich",
    role: "Contact enrichment",
    description:
      "Waterfall enrichment across 20+ data providers to find verified emails and mobile numbers for new decision-makers.",
    detail: "97% match rate this month",
    lastSync: "Last enrichment 12 min ago",
    successDetail: "Waterfall enrichment is ready across 20+ providers.",
  },
  hubspot: {
    id: "hubspot",
    name: "HubSpot",
    role: "CRM",
    description:
      "Source of closed-lost opportunities and their history; approved plays sync back as contacts, notes and tasks.",
    detail: "1,842 opportunities · 312 closed-lost",
    lastSync: "Synced 5 min ago",
    successDetail: "1,842 opportunities imported, 312 closed-lost indexed.",
  },
};

// Core stack = the pieces Re:lay reasons with: the signal engine, contact
// enrichment, and Claude, the agent's brain. HubSpot (the CRM) lives with the
// platform & channels below — a swappable source/sink around that core.
const CORE_CONNECTORS: Connector["id"][] = ["sillage", "fullenrich"];

// Copy for the env-key-driven pieces (Anthropic + the channels). Keyed on the
// service id union so a drifting id fails to compile instead of crashing render.
const PLATFORM_META: Record<
  PlatformIntegration["id"],
  { name: string; role: string; description: string; logo: string }
> = {
  anthropic: {
    name: "Anthropic",
    role: "The agent's brain",
    description:
      "Claude powers every judgment: the pipeline's autopsy, verdict and email (Sonnet 5) and the Ask Re:lay assistant (Haiku 4.5).",
    logo: PLATFORM_LOGOS.anthropic,
  },
  slack: {
    name: "Slack",
    role: "Team announcements",
    description:
      "Approved plays and pending reviews land in the channel as Block Kit messages, @-mentioning the assigned owner.",
    logo: PLATFORM_LOGOS.slack,
  },
  resend: {
    name: "Resend",
    role: "Email notifications",
    description:
      "The same events go out by email to the assigned owner — so a play never dies unseen in a channel.",
    logo: PLATFORM_LOGOS.resend,
  },
  gamma: {
    name: "Gamma",
    role: "Deck generation",
    description:
      "Every approved play ships with a personalized why-now micro-deck the rep can send or present.",
    logo: PLATFORM_LOGOS.gamma,
  },
  gradium: {
    name: "Gradium",
    role: "Voice",
    description:
      "Ultra-low-latency speech on the Ask Re:lay bubble — run and approve plays out loud.",
    logo: PLATFORM_LOGOS.gradium,
  },
};

// The rich connector card: a live status badge, the mocked story, and — for
// HubSpot with a real token — the live portal probe (real counts + refresh).
// Used under both headings (Sillage/FullEnrich in the core stack, HubSpot in
// platform & channels), so it takes everything it needs as props.
function ConnectorCard({
  connector,
  states,
  hubspotHealth,
  delayIndex,
}: {
  connector: Connector;
  states: ConnectorStates;
  hubspotHealth: HubSpotHealth;
  delayIndex: number;
}) {
  // HubSpot with a live token: the badge and body reflect the real probe;
  // otherwise it's the mocked connector toggle.
  const liveHubspot = connector.id === "hubspot" && hubspotHealth.mode === "live";
  const connected = liveHubspot ? hubspotHealth.connected : states[connector.id];

  return (
    <Card
      className={cn(
        "group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
        !connected && "border-dashed border-amber-600/40",
        ENTER,
      )}
      style={enterDelay(delayIndex)}
    >
      <CardHeader>
        <div className="mb-2 flex items-center justify-between">
          <span
            className={cn(
              "relative flex size-9 items-center justify-center rounded-lg border bg-white shadow-sm transition-all duration-300 group-hover:scale-110",
              !connected && "border-amber-600/40",
            )}
          >
            <Image src={CONNECTOR_LOGOS[connector.id]} alt="" width={20} height={20} />
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
        <CardTitle className="text-base">{connector.name}</CardTitle>
        <CardDescription>{connector.role}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{connector.description}</p>
        <div className="border-t pt-3">
          {liveHubspot && hubspotHealth.connected ? (
            <div className="space-y-2">
              <p className="font-medium">
                {hubspotHealth.companies} companies · {hubspotHealth.closedLost} closed-lost ·{" "}
                {hubspotHealth.contacts} contacts
              </p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs">Live portal · checked just now</p>
                <RefreshHubspotButton />
              </div>
            </div>
          ) : liveHubspot ? (
            <div className="space-y-2">
              <p className="font-medium text-red-600 dark:text-red-400">Token invalid or expired</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs">{hubspotHealth.detail}</p>
                <RefreshHubspotButton />
              </div>
            </div>
          ) : connected ? (
            <>
              <p className="font-medium">{connector.detail}</p>
              <p className="text-muted-foreground text-xs">{connector.lastSync}</p>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs">Connect to bring Re:lay online.</p>
              {connector.id === "sillage" ? (
                <SillageConnectDialog />
              ) : (
                <ConnectDialog
                  id={connector.id}
                  name={connector.name}
                  successDetail={connector.successDetail}
                />
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// The env-key-driven card: Claude and the notification/output channels. Status
// is connected (key live), missing (key absent), or soon (on the roadmap).
function PlatformCard({
  piece,
  meta,
  delayIndex,
}: {
  piece: PlatformIntegration;
  meta: { name: string; role: string; description: string; logo: string };
  delayIndex: number;
}) {
  return (
    <Card
      className={cn(
        "group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
        piece.status !== "connected" && "border-dashed",
        piece.status === "soon" && "opacity-90",
        ENTER,
      )}
      style={enterDelay(delayIndex)}
    >
      <CardHeader>
        <div className="mb-2 flex items-center justify-between">
          <span className="relative flex size-9 items-center justify-center rounded-lg border bg-white shadow-sm transition-all duration-300 group-hover:scale-110">
            <Image src={meta.logo} alt="" width={20} height={20} />
          </span>
          {piece.status === "connected" && (
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
          )}
          {piece.status === "missing" && (
            <Badge variant="secondary" className="text-muted-foreground">
              <KeyRound aria-hidden />
              Key missing
            </Badge>
          )}
          {piece.status === "soon" && (
            <Badge variant="secondary" className="bg-primary/10 text-primary dark:bg-primary/15">
              <Sparkles aria-hidden />
              Coming soon
            </Badge>
          )}
        </div>
        <CardTitle className="text-base">{meta.name}</CardTitle>
        <CardDescription>{meta.role}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{meta.description}</p>
        <div className="border-t pt-3">
          {piece.status === "connected" ? (
            <p className="font-medium">{piece.detail}</p>
          ) : (
            <p className="text-muted-foreground text-xs">{piece.hint}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function IntegrationsPage() {
  const [states, hubspotHealth] = await Promise.all([getConnectorStates(), getHubSpotHealth()]);
  const platform = platformIntegrations();

  // Core stack: the two connect-flow connectors, then Claude (the brain).
  const anthropic = platform.find((p) => p.id === "anthropic");
  // Platform & channels: HubSpot (the CRM), then the notification/output channels.
  const hubspot = CONNECTORS.hubspot;
  const channels = platform.filter((p) => p.id !== "anthropic");

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className={`mb-8 ${ENTER}`}>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Re:lay sits on top of your existing stack — signals in, plays out.
        </p>
      </div>

      <h2 className={`text-muted-foreground mb-3 text-sm font-medium ${ENTER}`}>Core stack</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {CORE_CONNECTORS.map((id, index) => (
          <ConnectorCard
            key={id}
            connector={CONNECTORS[id]}
            states={states}
            hubspotHealth={hubspotHealth}
            delayIndex={index + 1}
          />
        ))}
        {anthropic && (
          <PlatformCard
            piece={anthropic}
            meta={PLATFORM_META.anthropic}
            delayIndex={CORE_CONNECTORS.length + 1}
          />
        )}
      </div>

      <h2 className={`text-muted-foreground mt-10 mb-3 text-sm font-medium ${ENTER}`}>
        Platform &amp; channels
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        <ConnectorCard
          connector={hubspot}
          states={states}
          hubspotHealth={hubspotHealth}
          delayIndex={1}
        />
        {channels.map((piece, index) => (
          <PlatformCard
            key={piece.id}
            piece={piece}
            meta={PLATFORM_META[piece.id]}
            delayIndex={index + 2}
          />
        ))}
      </div>
    </main>
  );
}
