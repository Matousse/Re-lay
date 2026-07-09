import { env } from "@/lib/env";
import type { ChannelMessage } from "@/types/notifications";

// Emails a rendered message via Resend's REST API
// (https://resend.com/docs/api-reference/emails/send-email). Env-gated on
// both the API key and a recipient — with either missing the call is a no-op
// that reports "not notified", same story as the Slack channel.

const RESEND_URL = "https://api.resend.com/emails";
// Resend's shared test sender: works with zero DNS setup, ideal for the demo.
const DEFAULT_FROM = "Re:lay <onboarding@resend.dev>";

type EmailOptions = { apiKey?: string; to?: string; from?: string; fetchImpl?: typeof fetch };

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function toHtml(message: ChannelMessage): string {
  const rows = message.facts
    .map(
      (fact) =>
        `<tr><td style="padding:2px 16px 2px 0;color:#6b7280;white-space:nowrap;">${escapeHtml(fact.label)}</td>` +
        `<td style="padding:2px 0;">${escapeHtml(fact.value)}</td></tr>`,
    )
    .join("");
  const footer = message.footer
    ? `<p style="margin:12px 0 0;color:#6b7280;font-size:13px;">${escapeHtml(message.footer)}</p>`
    : "";
  return `<h2 style="margin:0 0 12px;font-size:16px;">${escapeHtml(message.headline)}</h2><table>${rows}</table>${footer}`;
}

export async function sendEmail(
  message: ChannelMessage,
  {
    apiKey = env.RESEND_API_KEY,
    to = env.NOTIFY_EMAIL_TO,
    from = env.RESEND_FROM ?? DEFAULT_FROM,
    fetchImpl = fetch,
  }: EmailOptions = {},
): Promise<boolean> {
  if (!apiKey || !to) return false;

  try {
    const response = await fetchImpl(RESEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from,
        to: [to],
        subject: message.headline,
        html: toHtml(message),
      }),
    });
    return response.ok;
  } catch {
    // A down provider must never break the action that emitted the event.
    return false;
  }
}
