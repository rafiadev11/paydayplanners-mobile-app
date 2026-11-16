import {
  clearPaydayNotifications,
  paydayNotificationCapacity,
} from "./payday-notification-store";
import { useBillReminders } from "./bill-reminder-context";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Linking, Platform } from "react-native";
import { useAuth } from "@features/auth/auth-context";
import { fetchPaycheckOccurrences } from "@features/planning/api";
import { trackRetention } from "@features/retention/tracking";
import { usePlanningRevision } from "@shared/api/planning-revision";
import { getAppTimezone } from "@shared/lib/timezone";
import {
  buildPaydayReminders,
  defaultPaydayPreferences,
  parsePaydayPreferences,
  type PaydayPreferences,
} from "./payday-schedule";

const TYPE = "payday-reminder";
const keyFor = (id: string) => `paydayplanners.payday_reminders.${id}`;
async function cancelPaydayNotifications(preserveUserId?: string) {
  await clearPaydayNotifications(Notifications, preserveUserId);
}
type ContextValue = {
  preferences: PaydayPreferences;
  ready: boolean;
  busy: boolean;
  count: number;
  message: string | null;
  save: (next: PaydayPreferences) => Promise<void>;
  refresh: () => void;
  openSettings: () => void;
};
const Context = createContext<ContextValue | null>(null);

export function PaydayReminderProvider({ children }: { children: ReactNode }) {
  const { ready: authReady, user } = useAuth();
  const { ready: billRemindersReady } = useBillReminders();
  const revision = usePlanningRevision();
  const id = user ? String(user.id) : null;
  const currentId = useRef(id);
  currentId.current = id;
  const generation = useRef(0);
  const serial = useRef<Promise<void>>(Promise.resolve());
  const settings = useRef(defaultPaydayPreferences);
  const [preferences, setPreferences] = useState(defaultPaydayPreferences);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const lastFingerprint = useRef("");

  const enqueue = useCallback((task: () => Promise<void>) => {
    const operation = serial.current.then(task);
    serial.current = operation.catch(() => {});
    return operation;
  }, []);

  const sync = useCallback(
    async (owner: string, prefs: PaydayPreferences, epoch: number) => {
      const valid = () =>
        currentId.current === owner && generation.current === epoch;
      if (!valid()) return;
      const permission = await Notifications.getPermissionsAsync();
      if (!valid()) return;
      if (!prefs.enabled || permission.status !== "granted") {
        await cancelPaydayNotifications();
        lastFingerprint.current = "";
        setCount(0);
        if (prefs.enabled)
          setMessage(
            "Notifications are blocked. Open device settings to allow them.",
          );
        return;
      }
      const paychecks = await fetchPaycheckOccurrences(365);
      if (!valid()) return;
      const requests = await Notifications.getAllScheduledNotificationsAsync();
      const capacity = paydayNotificationCapacity(requests);
      const groups = buildPaydayReminders(paychecks, prefs).slice(0, capacity);
      const fingerprint = JSON.stringify([owner, getAppTimezone(), groups]);
      const existing = requests.filter((r) => r.content.data?.type === TYPE);
      if (!valid()) return;
      if (
        lastFingerprint.current === fingerprint &&
        existing.length === groups.length &&
        existing.every((r) => r.content.data?.userId === owner)
      ) {
        setCount(existing.length);
        return;
      }
      await cancelPaydayNotifications();
      if (!valid()) return;
      const created: string[] = [];
      try {
        for (const group of groups) {
          if (!valid()) throw new Error("Reminder settings changed");
          created.push(
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "Your payday plan is ready to review",
                body: "Check upcoming bills and what remains in your plan.",
                sound: false,
                data: { type: TYPE, userId: owner, payday: group.payday },
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: group.date,
                channelId: Platform.OS === "android" ? TYPE : undefined,
              },
            }),
          );
        }
        if (!valid()) throw new Error("Reminder settings changed");
        lastFingerprint.current = fingerprint;
        setCount(created.length);
        setMessage(
          created.length
            ? `${created.length} payday reminders scheduled. Future dates refresh when you use the app.`
            : capacity === 0
              ? "This device’s reminder slots are full. Refresh bill reminders, then try again."
              : "No upcoming reminders yet. Add a future payday or choose a later reminder time.",
        );
      } catch (error) {
        await Promise.all(
          created.map((identifier) =>
            Notifications.cancelScheduledNotificationAsync(identifier),
          ),
        );
        throw error;
      }
    },
    [],
  );

  useEffect(() => {
    if (!authReady || (id && !billRemindersReady)) return;
    const epoch = ++generation.current;
    setReady(false);
    setCount(0);
    setMessage(null);
    lastFingerprint.current = "";
    void enqueue(async () => {
      await cancelPaydayNotifications(id ?? undefined);
      if (!id || currentId.current !== id || generation.current !== epoch)
        return;
      if (Platform.OS === "android")
        await Notifications.setNotificationChannelAsync(TYPE, {
          name: "Payday reminders",
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: null,
        });
      const prefs = parsePaydayPreferences(
        await SecureStore.getItemAsync(keyFor(id)),
      );
      if (currentId.current !== id || generation.current !== epoch) return;
      settings.current = prefs;
      setPreferences(prefs);
      setReady(true);
      await sync(id, prefs, epoch);
    }).catch(() => {
      if (generation.current === epoch)
        setMessage("Could not refresh payday reminders. Please try again.");
    });
    return () => {
      generation.current += 1;
    };
  }, [authReady, billRemindersReady, id, enqueue, sync]);

  const refresh = useCallback(() => {
    if (!id || !ready) return;
    const epoch = generation.current;
    void enqueue(() => sync(id, settings.current, epoch)).catch(() => {
      if (currentId.current === id)
        setMessage("Could not refresh payday reminders. Please try again.");
    });
  }, [id, ready, enqueue, sync]);
  useEffect(() => {
    refresh();
  }, [revision, user?.timezone, refresh]);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => listener.remove();
  }, [refresh]);

  const save = async (next: PaydayPreferences) => {
    if (!id || !ready || busy) return;
    const owner = id;
    const epoch = ++generation.current;
    setBusy(true);
    setMessage(null);
    try {
      await enqueue(async () => {
        const valid = () =>
          currentId.current === owner && generation.current === epoch;
        if (!valid()) return;
        if (next.enabled) {
          const existing = await Notifications.getPermissionsAsync();
          const permission =
            existing.status === "granted"
              ? existing
              : await Notifications.requestPermissionsAsync();
          if (!valid()) return;
          if (permission.status !== "granted") {
            setMessage(
              "Allow notifications in device settings to enable payday reminders.",
            );
            return;
          }
          if (existing.status !== "granted")
            trackRetention("notification_permission_granted");
        }
        await SecureStore.setItemAsync(keyFor(owner), JSON.stringify(next));
        if (!valid()) return;
        const changed = next.enabled !== settings.current.enabled;
        settings.current = next;
        setPreferences(next);
        if (changed)
          trackRetention(
            next.enabled
              ? "payday_reminder_enabled"
              : "payday_reminder_disabled",
          );
        await sync(owner, next, epoch);
        if (!next.enabled && valid())
          setMessage("Payday reminders are off on this device.");
      });
    } catch {
      if (currentId.current === owner)
        setMessage("Could not update payday reminders. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Context.Provider
      value={{
        preferences,
        ready,
        busy,
        count,
        message,
        save,
        refresh,
        openSettings: () => {
          void Linking.openSettings();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function usePaydayReminders() {
  const context = useContext(Context);
  if (!context) throw new Error("PaydayReminderProvider is required");
  return context;
}
