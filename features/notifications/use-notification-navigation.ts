import * as Notifications from "expo-notifications";
import { useRootNavigationState, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { trackRetention } from "@features/retention/tracking";
import { notificationRoute } from "./notification-route";

export function useNotificationNavigation(
  userId: string | null,
  unlocked: boolean,
) {
  const response = Notifications.useLastNotificationResponse();
  const navigation = useRootNavigationState();
  const router = useRouter();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!response || !navigation?.key || !userId || !unlocked) return;
    const request = response.notification.request;
    if (handled.current === request.identifier) return;
    handled.current = request.identifier;
    const route = notificationRoute(request.content.data ?? {}, userId);
    if (route) {
      if (request.content.data?.type === "payday-reminder")
        trackRetention("payday_reminder_tapped");
      router.push(route);
    }
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, [response, navigation?.key, userId, unlocked, router]);
}
