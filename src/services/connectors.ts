import { fetchConnectorStates, persistConnection } from "@/integrations/connectors";
import { getNotificationRouting } from "@/integrations/notifications/routing";
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

// The platform pieces around the core stack — status derives from the env
// (real keys, no demo connect flow) plus the assigned notification routing.
export type PlatformIntegration = {
  id: "anthropic" | "slack" | "resend" | "gamma" | "gradium";
  status: "connected" | "missing" | "soon";
  detail: string;
  hint: string;
};

export function platformIntegrations(): PlatformIntegration[] {
  const routing = getNotificationRouting();
  const emailRecipient = routing?.email ?? env.NOTIFY_EMAIL_TO;
  return [
    {
      id: "anthropic",
      status: env.ANTHROPIC_API_KEY ? "connected" : "missing",
      detail: "Sonnet 5 reasons in the pipeline · Haiku 4.5 answers in the chat",
      hint: "Set ANTHROPIC_API_KEY in .env",
    },
    {
      id: "slack",
      status: env.SLACK_WEBHOOK_URL ? "connected" : "missing",
      detail: routing?.slackMemberId
        ? `Plays announced with an @-mention for ${routing.name}`
        : "Plays announced to the channel — assign an owner via the assistant",
      hint: "Set SLACK_WEBHOOK_URL in .env",
    },
    {
      id: "resend",
      status: env.RESEND_API_KEY && emailRecipient ? "connected" : "missing",
      detail: emailRecipient
        ? `Plays emailed to ${emailRecipient}`
        : "Plays emailed to the assigned owner",
      hint: "Set RESEND_API_KEY and NOTIFY_EMAIL_TO in .env",
    },
    {
      id: "gamma",
      status: "soon",
      detail: "",
      hint: "On the roadmap — a personalized why-now micro-deck generated with every approved play.",
    },
    {
      id: "gradium",
      status: env.GRADIUM_API_KEY ? "connected" : "soon",
      detail: env.GRADIUM_API_KEY
        ? "Hold the mic on Ask Re:lay to talk — Gradium STT in, TTS out"
        : "",
      hint: env.GRADIUM_API_KEY
        ? "Talk to the Ask Re:lay bubble out loud, powered by Gradium voice."
        : "On the roadmap — talk to the Ask Re:lay bubble out loud, powered by Gradium voice.",
    },
  ];
}
