import { z } from "zod";

// Both keys are optional so this module can be imported anywhere without
// crashing: the demo runs fully offline on the fake integrations, and each
// real integration lights up when its key is present (see makeSignalSource /
// makeAnthropicClient call sites).
const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  SILLAGE_API_KEY: z.string().min(1).optional(),
  // Slack incoming-webhook URL. Set it and every approval posts to the channel;
  // unset, the approval flow just skips the notification.
  SLACK_WEBHOOK_URL: z.url().optional(),
  // Resend outbound email — the email channel needs both the key and a
  // recipient; with either missing it's a no-op, same gating as Slack.
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM: z.string().min(1).optional(),
  NOTIFY_EMAIL_TO: z.email().optional(),
});

export const env = envSchema.parse({
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  SILLAGE_API_KEY: process.env.SILLAGE_API_KEY,
  SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM: process.env.RESEND_FROM,
  NOTIFY_EMAIL_TO: process.env.NOTIFY_EMAIL_TO,
});
