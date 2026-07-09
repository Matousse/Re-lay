import { env } from "@/lib/env";
import type { ChannelMessage } from "@/types/notifications";

// Posts a rendered message to a Slack channel via an incoming webhook
// (https://api.slack.com/messaging/webhooks). Env-gated: with no
// SLACK_WEBHOOK_URL the call is a no-op that reports "not notified", so the
// demo runs without a Slack workspace and lights up the moment one is wired.

type SlackOptions = { webhookUrl?: string; fetchImpl?: typeof fetch };

export async function postToSlack(
  message: ChannelMessage,
  { webhookUrl = env.SLACK_WEBHOOK_URL, fetchImpl = fetch }: SlackOptions = {},
): Promise<boolean> {
  if (!webhookUrl) return false;

  // The assigned owner gets a real @-mention so the play lands on someone.
  const mention = message.audience?.slackMemberId ? `<@${message.audience.slackMemberId}> ` : "";
  const payload = {
    text: `${mention}${message.headline}`, // fallback for notifications and unfurls
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `${mention}${message.headline}` } },
      {
        type: "section",
        fields: message.facts.map((fact) => ({
          type: "mrkdwn",
          text: `*${fact.label}:*\n${fact.value}`,
        })),
      },
      ...(message.footer
        ? [{ type: "context", elements: [{ type: "mrkdwn", text: message.footer }] }]
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
    // A down webhook must never break the action that emitted the event.
    return false;
  }
}
