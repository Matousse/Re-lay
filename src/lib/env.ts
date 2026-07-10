import { z } from "zod";

// Both keys are optional so this module can be imported anywhere without
// crashing: the demo runs fully offline on the fake integrations, and each
// real integration lights up when its key is present (see makeSignalSource /
// makeAnthropicClient call sites).
const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  SILLAGE_API_KEY: z.string().min(1).optional(),
  // FullEnrich API key. Set it and `researcher` resolves verified emails/phones
  // via the real API; unset, it falls back to the deterministic fake contact.
  FULL_ENRICH_API_KEY: z.string().min(1).optional(),
  // HubSpot Private App access token (Settings → Integrations → Private Apps).
  // Set it and the CRM port talks to the real portal; unset, it runs on the
  // seeded FakeCrm (see makeCrm).
  HUBSPOT_ACCESS_TOKEN: z.string().min(1).optional(),
  // Slack incoming-webhook URL. Set it and every approval posts to the channel;
  // unset, the approval flow just skips the notification.
  SLACK_WEBHOOK_URL: z.url().optional(),
  // Model override for the chat assistant (defaults to Haiku for speed —
  // the deep reasoning lives in the pipeline, which keeps Sonnet).
  ASSISTANT_MODEL: z.string().min(1).optional(),
  // Resend outbound email — the email channel needs both the key and a
  // recipient; with either missing it's a no-op, same gating as Slack.
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM: z.string().min(1).optional(),
  NOTIFY_EMAIL_TO: z.email().optional(),
  // Gradium voice (STT + TTS) for the Ask Re:lay bubble. Set it and the mic
  // button lights up (push-to-talk in, spoken replies out); unset, the bubble
  // stays text-only. GRADIUM_VOICE_ID picks the TTS voice (see docs.gradium.ai).
  GRADIUM_API_KEY: z.string().min(1).optional(),
  GRADIUM_VOICE_ID: z.string().min(1).optional(),
});

// A .env copied from .env.example still carries <PLACEHOLDER> values — and
// script/setup.sh does exactly that copy. "Optional" in Zod means *absent*, not
// *present but invalid*, so an unfilled url()/email() field would crash the
// parse. Treat empty strings and <...> placeholders as unset: the integration
// just stays on its fake until a real value is filled in.
function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || /^<.*>$/.test(trimmed)) return undefined;
  return trimmed;
}

export const env = envSchema.parse({
  ANTHROPIC_API_KEY: clean(process.env.ANTHROPIC_API_KEY),
  SILLAGE_API_KEY: clean(process.env.SILLAGE_API_KEY),
  FULL_ENRICH_API_KEY: clean(process.env.FULL_ENRICH_API_KEY),
  HUBSPOT_ACCESS_TOKEN: clean(process.env.HUBSPOT_ACCESS_TOKEN),
  SLACK_WEBHOOK_URL: clean(process.env.SLACK_WEBHOOK_URL),
  ASSISTANT_MODEL: clean(process.env.ASSISTANT_MODEL),
  RESEND_API_KEY: clean(process.env.RESEND_API_KEY),
  RESEND_FROM: clean(process.env.RESEND_FROM),
  NOTIFY_EMAIL_TO: clean(process.env.NOTIFY_EMAIL_TO),
  GRADIUM_API_KEY: clean(process.env.GRADIUM_API_KEY),
  GRADIUM_VOICE_ID: clean(process.env.GRADIUM_VOICE_ID),
});
