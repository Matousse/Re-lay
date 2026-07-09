import { sendEmail } from "@/integrations/notifications/email";
import { getNotificationRouting } from "@/integrations/notifications/routing";
import { postToSlack } from "@/integrations/notifications/slack";
import { formatCurrency } from "@/lib/format";
import type { ChannelMessage, NotificationResults, RelayEvent } from "@/types/notifications";

// Renders domain events into the neutral message model and fans them out to
// every channel. Channels are env-gated no-ops when unconfigured and
// fail-safe when down — and each call is guarded here too — so dispatching
// can never break the action that emitted the event.

function render(event: RelayEvent): ChannelMessage {
  const c = event.case;
  const company = c.deal.company.name;
  const contact = c.plan?.targetContact;
  const score = `${c.verdict.score}/100 · ${c.verdict.decision.toUpperCase()}`;

  switch (event.type) {
    case "play_approved":
      return {
        headline: `🔥 Play approved — ${company} (${c.verdict.score}/100)`,
        facts: [
          { label: "Company", value: `${company} · ${formatCurrency(c.deal.amount)} recovered` },
          ...(contact
            ? [{ label: "Reaching out to", value: `${contact.name} — ${contact.role}` }]
            : []),
          ...(event.angleLabel ? [{ label: "Angle", value: event.angleLabel }] : []),
          { label: "Score", value: score },
        ],
        footer: contact ? `Re:lay drafted the outreach to ${contact.email}` : undefined,
      };
    case "review_requested":
      return {
        headline: `👀 Play ready for review — ${company} (${c.verdict.score}/100)`,
        facts: [
          { label: "Company", value: `${company} · ${formatCurrency(c.deal.amount)} at stake` },
          { label: "Signal", value: c.signal.title },
          { label: "Score", value: score },
        ],
        footer: "Nothing is sent until a human approves it in Re:lay.",
      };
  }
}

type Channels = { slack: typeof postToSlack; email: typeof sendEmail };

export async function dispatchEvent(
  event: RelayEvent,
  channels: Partial<Channels> = {},
): Promise<NotificationResults> {
  const message = render(event);
  // Assigned owner (route_notifications tool): @-mention on Slack, direct
  // recipient on email. Falls back to the plain channel + NOTIFY_EMAIL_TO.
  const routing = getNotificationRouting();
  if (routing) {
    message.audience = { name: routing.name, slackMemberId: routing.slackMemberId };
  }
  const [slack, email] = await Promise.all([
    (channels.slack ?? postToSlack)(message).catch(() => false),
    (channels.email ?? sendEmail)(message, routing?.email ? { to: routing.email } : {}).catch(
      () => false,
    ),
  ]);
  return { slack, email };
}
