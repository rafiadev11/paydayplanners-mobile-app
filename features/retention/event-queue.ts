export type RetentionEventName =
  | "app_opened"
  | "plan_viewed"
  | "payday_plan_reviewed"
  | "bill_marked_paid"
  | "payday_reminder_enabled"
  | "payday_reminder_disabled"
  | "notification_permission_granted"
  | "payday_reminder_tapped";
export type RetentionEvent = {
  event_id: string;
  name: RetentionEventName;
  occurred_at: string;
  platform: "ios" | "android";
  app_version: string;
};

export function createEventQueue(
  send: (token: string, events: RetentionEvent[]) => Promise<void>,
) {
  let session: {
    token: string;
    events: RetentionEvent[];
    sending: boolean;
  } | null = null;
  return {
    reset(token: string | null) {
      if (session?.token === token) return;
      session = token ? { token, events: [], sending: false } : null;
    },
    add(event: RetentionEvent) {
      if (!session) return;
      if (session.events.length >= 40) return;
      session.events.push(event);
    },
    async flush() {
      const current = session;
      if (!current || current.sending) return;
      current.events = current.events.filter(
        (event) => Date.parse(event.occurred_at) >= Date.now() - 7 * 86400000,
      );
      current.sending = true;
      try {
        while (session === current && current.events.length) {
          const batch = current.events.slice(0, 20);
          await send(current.token, batch);
          current.events.splice(0, batch.length);
        }
      } catch {
        // A bounded in-memory queue retries on the next foreground or action.
      } finally {
        current.sending = false;
      }
    },
  };
}
