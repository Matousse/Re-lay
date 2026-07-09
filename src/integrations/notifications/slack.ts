import { env } from "@/lib/env";
import { formatCurrency } from "@/lib/format";
import type { ReengagementCase } from "@/types/reengagement";

// Posts approved plays to a Slack channel via an incoming webhook
// (https://api.slack.com/messaging/webhooks). Env-gated: with no
// SLACK_WEBHOOK_URL the call is a no-op that reports "not notified", so the
// demo runs without a Slack workspace and lights up the moment one is wired.

type NotifyOptions = { webhookUrl?: string; fetchImpl?: typeof fetch };

export async function notifyPlayApproved(
  c: ReengagementCase,
  angleLabel: string | undefined,
  { webhookUrl = env.SLACK_WEBHOOK_URL, fetchImpl = fetch }: NotifyOptions = {},
): Promise<boolean> {
  if (!webhookUrl) return false;

  const contact = c.plan?.targetContact;
  const summary = `:fire: Play approved — ${c.deal.company.name} (${c.verdict.score}/100)`;
  const fields = [
    `*Company:*\n${c.deal.company.name} · ${formatCurrency(c.deal.amount)} recovered`,
    contact ? `*Reaching out to:*\n${contact.name} — ${contact.role}` : null,
    angleLabel ? `*Angle:*\n${angleLabel}` : null,
    `*Score:*\n${c.verdict.score}/100 · ${c.verdict.decision.toUpperCase()}`,
  ].filter((field): field is string => field !== null);

  const payload = {
    text: summary, // fallback for notifications and unfurls
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: summary } },
      { type: "section", fields: fields.map((text) => ({ type: "mrkdwn", text })) },
      ...(contact
        ? [
            {
              type: "context",
              elements: [
                { type: "mrkdwn", text: `Re:lay drafted the outreach to ${contact.email}` },
              ],
            },
          ]
        : []),
    ],
  };

  try {
    const response = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    // A down webhook must never break the approval itself.
    return false;
  }
}
