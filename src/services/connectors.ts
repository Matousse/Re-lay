import { fetchConnectorStates, persistConnection } from "@/integrations/connectors";
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
