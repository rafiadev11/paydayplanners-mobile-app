type ScheduledNotification = {
  identifier: string;
  content: { data?: Record<string, unknown> };
};

export async function clearPaydayNotifications(
  notifications: {
    getAllScheduledNotificationsAsync: () => Promise<ScheduledNotification[]>;
    cancelScheduledNotificationAsync: (identifier: string) => Promise<void>;
  },
  preserveUserId?: string,
) {
  const requests = await notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    requests
      .filter((request) => request.content.data?.type === "payday-reminder")
      .filter(
        (request) =>
          preserveUserId === undefined ||
          request.content.data?.userId !== preserveUserId,
      )
      .map((request) =>
        notifications.cancelScheduledNotificationAsync(request.identifier),
      ),
  );
}

export function paydayNotificationCapacity(requests: ScheduledNotification[]) {
  const otherNotifications = requests.filter(
    (request) => request.content.data?.type !== "payday-reminder",
  ).length;
  return Math.max(0, Math.min(20, 60 - otherNotifications));
}
