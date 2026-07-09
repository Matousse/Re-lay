import { z } from "zod";

// Input shapes shared by every face of onboarding — the agent tools
// (services/relay-tools.ts) and the wizard's HTTP route (api/onboarding) —
// so the assistant, the MCP and the UI can never drift apart on what a
// company context or a routing looks like.

export const CompanyContextInputSchema = z.object({
  offering: z.string().min(1).describe("What the company sells, one or two sentences"),
  icp: z.string().min(1).describe("Who they sell to (roles, company profile)"),
  stakes: z.string().min(1).describe("Why prospects buy — the pains and stakes"),
  website: z.url().optional(),
  notes: z.string().optional().describe("Anything else worth remembering"),
});
export type CompanyContextInput = z.infer<typeof CompanyContextInputSchema>;

export const NotificationRoutingInputSchema = z.object({
  name: z.string().min(1).describe("The person's name"),
  email: z.email().optional(),
  slackMemberId: z
    .string()
    .regex(/^[UW][A-Z0-9]{6,}$/i, "Slack member IDs look like U0123ABCD")
    .optional()
    .describe("Slack member ID (profile → three dots → Copy member ID)"),
});
export type NotificationRoutingInput = z.infer<typeof NotificationRoutingInputSchema>;

// Cross-field rule kept out of the schema on purpose: refined schemas stop
// being plain ZodObjects, which the MCP adapter needs for its inputSchema.
export function routingHasChannel(routing: { email?: string; slackMemberId?: string }): boolean {
  return Boolean(routing.email || routing.slackMemberId);
}
