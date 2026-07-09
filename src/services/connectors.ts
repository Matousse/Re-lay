import { fetchConnectorStates, persistConnection } from "@/integrations/connectors";
import { env } from "@/lib/env";
import { CONNECTOR_NAMES, type ConnectorId, type ConnectorStates } from "@/types/connectors";

export async function getConnectorStates(): Promise<ConnectorStates> {
  return fetchConnectorStates();
}

export async function connectConnector(id: ConnectorId): Promise<ConnectorStates> {
  return persistConnection(id);
}

export async function allConnected(): Promise<boolean> {
  const states = await fetchConnectorStates();
  return Object.values(states).every(Boolean);
}

/** Connectors still missing (id + display name), for setup prompts. */
export async function missingConnectors(): Promise<{ id: ConnectorId; name: string }[]> {
  const states = await fetchConnectorStates();
  return (Object.keys(states) as ConnectorId[])
    .filter((id) => !states[id])
    .map((id) => ({ id, name: CONNECTOR_NAMES[id] }));
}

// The platform pieces around the core stack. Anthropic is live from its env key;
// Slack, Resend, Gamma and Gradium are presented as roadmap ("coming soon"). The
// notification plumbing (Slack/email dispatch) exists and stays wired — it just
// ships once those channels are set up, so we don't advertise them as live yet.
export type PlatformIntegration = {
  id: "anthropic" | "slack" | "resend" | "gamma" | "gradium";
  status: "connected" | "missing" | "soon";
  detail: string;
  hint: string;
};

export function platformIntegrations(): PlatformIntegration[] {
  return [
    {
      id: "anthropic",
      status: env.ANTHROPIC_API_KEY ? "connected" : "missing",
      detail: "Sonnet 5 reasons in the pipeline · Haiku 4.5 answers in the chat",
      hint: "Set ANTHROPIC_API_KEY in .env",
    },
    {
      id: "slack",
      status: "soon",
      detail: "",
      hint: "On the roadmap — approved plays announced to your channel, @-mentioning the assigned owner.",
    },
    {
      id: "resend",
      status: "soon",
      detail: "",
      hint: "On the roadmap — the same plays emailed to the deal owner, so a play never dies unseen in a channel.",
    },
    {
      id: "gamma",
      status: "soon",
      detail: "",
      hint: "On the roadmap — a personalized why-now micro-deck generated with every approved play.",
    },
    {
      id: "gradium",
      status: "soon",
      detail: "",
      hint: "On the roadmap — talk to the Ask Re:lay bubble out loud, powered by Gradium voice.",
    },
  ];
}
