import { z } from "zod";

export const ConnectorIdSchema = z.enum(["sillage", "fullenrich", "hubspot"]);

export const ConnectInputSchema = z.object({
  id: ConnectorIdSchema,
});

export type ConnectorId = z.infer<typeof ConnectorIdSchema>;
export type ConnectorStates = Record<ConnectorId, boolean>;

export const CONNECTOR_NAMES: Record<ConnectorId, string> = {
  sillage: "Sillage",
  fullenrich: "FullEnrich",
  hubspot: "HubSpot",
};
