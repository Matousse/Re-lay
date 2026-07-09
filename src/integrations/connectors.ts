import type { ConnectorId, ConnectorStates } from "@/types/connectors";

// Demo opens with Sillage disconnected: no signal engine, no pipeline. The
// connect flow is the first beat of the demo. Anchored on globalThis like the
// other demo stores so route handlers and RSC share state.
const DEFAULT_STATES: ConnectorStates = {
  sillage: false,
  fullenrich: true,
  hubspot: true,
};

const globalStore = globalThis as { __relayConnectors?: ConnectorStates };
const states = (globalStore.__relayConnectors ??= { ...DEFAULT_STATES });

export async function fetchConnectorStates(): Promise<ConnectorStates> {
  return { ...states };
}

export async function persistConnection(id: ConnectorId): Promise<ConnectorStates> {
  states[id] = true;
  return { ...states };
}

export async function resetConnectors(): Promise<void> {
  Object.assign(states, DEFAULT_STATES);
}
