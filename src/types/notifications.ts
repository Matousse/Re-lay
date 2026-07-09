import type { ReengagementCase } from "@/types/reengagement";

// Domain events worth telling the team about. Services emit these through
// dispatchEvent (services/notifications.ts), which fans them out to every
// configured channel.
export type RelayEvent =
  | { type: "play_approved"; case: ReengagementCase; angleLabel?: string }
  | { type: "review_requested"; case: ReengagementCase };

// Neutral message model: the service renders an event into this once, and
// each channel formats it for its own wire (Slack Block Kit, email HTML).
export type ChannelMessage = {
  headline: string;
  facts: { label: string; value: string }[];
  footer?: string;
};

// Per-channel delivery outcome — false covers both "not configured" and
// "delivery failed", because neither may break the action that emitted the
// event.
export type NotificationResults = { slack: boolean; email: boolean };
