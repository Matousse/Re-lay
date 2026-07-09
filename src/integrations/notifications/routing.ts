// Who receives the plays: the assigned owner gets @-mentioned on Slack and
// becomes the email recipient, instead of anonymous channel noise. Set
// conversationally via the route_notifications tool. Anchored on globalThis
// like the other demo stores.

export type NotificationRouting = {
  name: string;
  email?: string;
  slackMemberId?: string;
  updatedAt: string;
};

const globalStore = globalThis as { __relayNotificationRouting?: NotificationRouting };

export function getNotificationRouting(): NotificationRouting | null {
  return globalStore.__relayNotificationRouting ?? null;
}

export function saveNotificationRouting(
  routing: Omit<NotificationRouting, "updatedAt">,
): NotificationRouting {
  const saved = { ...routing, updatedAt: new Date().toISOString() };
  globalStore.__relayNotificationRouting = saved;
  return saved;
}

export function resetNotificationRouting(): void {
  delete globalStore.__relayNotificationRouting;
}
