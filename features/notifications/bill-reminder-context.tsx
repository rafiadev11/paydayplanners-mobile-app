import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Linking, Platform } from "react-native";

import { useAuth } from "@features/auth/auth-context";
import {
  fetchBillOccurrences,
  type BillOccurrence,
} from "@features/planning/api";
import {
  dateAtTimeInAppTimezone,
  isoDateInAppTimezone,
  todayInAppTimezone,
} from "@shared/lib/timezone";
import {
  billReminderSchedulesStorage,
  notificationPrefsStorage,
} from "@shared/storage/secure";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const BILL_REMINDER_CHANNEL_ID = "bill-reminders";
const BILL_REMINDER_HOUR = 9;
const BILL_REMINDER_MINUTE = 0;
const BILL_REMINDER_WINDOW_DAYS = 365;
const MAX_SCHEDULED_REMINDER_GROUPS = 60;
const BILL_REMINDER_NOTIFICATION_TYPE = "bill-reminder";

type PermissionState =
  | Notifications.PermissionStatus
  | "unsupported"
  | "unavailable";

type ReminderPrefs = Record<string, { enabled: boolean }>;
type ReminderScheduleIndex = Record<string, string[]>;
type ReminderGroup = {
  date: Date;
  timing: "today" | "tomorrow";
  count: number;
};
type ReminderSyncResult = {
  scheduledCount: number;
  totalEligibleCount: number;
  lastScheduledDate: string | null;
};

type BillReminderContextValue = {
  ready: boolean;
  enabled: boolean;
  permissionStatus: PermissionState;
  scheduledCount: number;
  totalEligibleReminderCount: number;
  lastScheduledReminderDate: string | null;
  syncing: boolean;
  enableReminders: () => Promise<{
    ok: boolean;
    message: string;
    sync?: ReminderSyncResult;
  }>;
  disableReminders: () => Promise<void>;
  refreshReminders: () => Promise<{
    ok: boolean;
    message: string;
    sync?: ReminderSyncResult;
  }>;
  openDeviceSettings: () => Promise<void>;
};

const BillReminderContext = createContext<BillReminderContextValue | null>(
  null,
);

function userKey(value: number | string) {
  return String(value);
}

function parseJsonRecord<T extends Record<string, unknown>>(
  value: string | null,
): T {
  if (!value) {
    return {} as T;
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return parsed as T;
    }
  } catch {
    return {} as T;
  }

  return {} as T;
}

async function loadReminderPrefs() {
  return parseJsonRecord<ReminderPrefs>(await notificationPrefsStorage.get());
}

async function saveReminderPrefs(nextPrefs: ReminderPrefs) {
  await notificationPrefsStorage.set(JSON.stringify(nextPrefs));
}

async function loadReminderScheduleIndex() {
  return parseJsonRecord<ReminderScheduleIndex>(
    await billReminderSchedulesStorage.get(),
  );
}

async function saveReminderScheduleIndex(nextIndex: ReminderScheduleIndex) {
  await billReminderSchedulesStorage.set(JSON.stringify(nextIndex));
}

async function getScheduledReminderCount(id: number | string) {
  const index = await loadReminderScheduleIndex();
  return index[userKey(id)]?.length ?? 0;
}

async function getUserReminderEnabled(id: number | string) {
  const prefs = await loadReminderPrefs();
  return prefs[userKey(id)]?.enabled === true;
}

async function setUserReminderEnabled(id: number | string, enabled: boolean) {
  const prefs = await loadReminderPrefs();
  prefs[userKey(id)] = { enabled };
  await saveReminderPrefs(prefs);
}

async function cancelScheduledReminderIdentifiers(identifiers: string[]) {
  const uniqueIdentifiers = [...new Set(identifiers)];

  await Promise.all(
    uniqueIdentifiers.map(async (identifier) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(identifier);
      } catch {
        return;
      }
    }),
  );
}

async function getScheduledBillReminderIdentifiers(id?: number | string) {
  try {
    const requests = await Notifications.getAllScheduledNotificationsAsync();
    const key = id === undefined ? null : userKey(id);

    return requests
      .filter((request) => {
        const data = request.content.data;

        if (data?.type !== BILL_REMINDER_NOTIFICATION_TYPE) {
          return false;
        }

        return key === null || String(data.userId ?? "") === key;
      })
      .map((request) => request.identifier);
  } catch {
    return [];
  }
}

async function cancelScheduledRemindersForUser(id: number | string) {
  const key = userKey(id);
  const index = await loadReminderScheduleIndex();
  const identifiers = [
    ...(index[key] ?? []),
    ...(await getScheduledBillReminderIdentifiers(id)),
  ];

  await cancelScheduledReminderIdentifiers(identifiers);

  delete index[key];
  await saveReminderScheduleIndex(index);
}

async function storeScheduledRemindersForUser(
  id: number | string,
  identifiers: string[],
) {
  const index = await loadReminderScheduleIndex();
  index[userKey(id)] = identifiers;
  await saveReminderScheduleIndex(index);
}

async function cancelAllScheduledBillReminders() {
  const index = await loadReminderScheduleIndex();
  const identifiers = [
    ...Object.values(index).flat(),
    ...(await getScheduledBillReminderIdentifiers()),
  ];

  await cancelScheduledReminderIdentifiers(identifiers);

  await saveReminderScheduleIndex({});
}

async function ensureNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(BILL_REMINDER_CHANNEL_ID, {
    name: "Bill reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    vibrationPattern: [0, 180, 80, 180],
    lightColor: "#146B5C",
  });
}

async function getPermissionStatus(): Promise<PermissionState> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    return settings.status;
  } catch {
    return "unavailable";
  }
}

function reminderDateInAppTimezone(value: string, offsetDays = 0) {
  return dateAtTimeInAppTimezone(
    value,
    BILL_REMINDER_HOUR,
    BILL_REMINDER_MINUTE,
    offsetDays,
  );
}

function reminderDateForOccurrence(occurrence: BillOccurrence) {
  const now = new Date();
  const primary = reminderDateInAppTimezone(occurrence.due_date, -1);
  const fallback = reminderDateInAppTimezone(occurrence.due_date, 0);

  if (primary && primary.getTime() > now.getTime()) {
    return {
      date: primary,
      timing: "tomorrow" as const,
    };
  }

  if (fallback && fallback.getTime() > now.getTime()) {
    return {
      date: fallback,
      timing: "today" as const,
    };
  }

  return null;
}

function buildReminderGroups(occurrences: BillOccurrence[]) {
  const groups = new Map<string, ReminderGroup>();

  for (const occurrence of occurrences) {
    if (occurrence.status === "paid" || occurrence.status === "skipped") {
      continue;
    }

    if (occurrence.due_date < todayInAppTimezone()) {
      continue;
    }

    const reminder = reminderDateForOccurrence(occurrence);
    if (!reminder) {
      continue;
    }

    const key = reminder.date.toISOString();
    const current = groups.get(key);

    if (current) {
      current.count += 1;
      continue;
    }

    groups.set(key, {
      date: reminder.date,
      timing: reminder.timing,
      count: 1,
    });
  }

  return [...groups.values()].sort(
    (left, right) => left.date.getTime() - right.date.getTime(),
  );
}

async function scheduleGroupedReminders(
  id: number | string,
  groups: ReminderGroup[],
) {
  const identifiers: string[] = [];
  const key = userKey(id);

  try {
    for (const group of groups) {
      const label =
        group.count === 1
          ? "You have a bill due"
          : `You have ${group.count} bills due`;
      const timingLabel = group.timing === "today" ? "today." : "tomorrow.";
      const reviewLabel = group.count === 1 ? "review it." : "review them.";

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Upcoming bill reminder",
          body: `${label} ${timingLabel} Open Payday Planner to ${reviewLabel}`,
          sound: false,
          data: {
            type: BILL_REMINDER_NOTIFICATION_TYPE,
            userId: key,
            screen: "/money?tab=bills",
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: group.date,
          channelId:
            Platform.OS === "android" ? BILL_REMINDER_CHANNEL_ID : undefined,
        },
      });

      identifiers.push(identifier);
    }
  } catch (error) {
    await cancelScheduledReminderIdentifiers(identifiers);

    throw error;
  }

  return identifiers;
}

async function syncRemindersForUser(id: number | string) {
  const occurrences = await fetchBillOccurrences(BILL_REMINDER_WINDOW_DAYS);
  const groups = buildReminderGroups(occurrences);
  const scheduledGroups = groups.slice(0, MAX_SCHEDULED_REMINDER_GROUPS);

  await cancelScheduledRemindersForUser(id);

  const identifiers = await scheduleGroupedReminders(id, scheduledGroups);

  try {
    await storeScheduledRemindersForUser(id, identifiers);
  } catch (error) {
    await cancelScheduledReminderIdentifiers(identifiers);
    throw error;
  }

  const lastScheduledGroup = scheduledGroups.at(-1);

  return {
    scheduledCount: identifiers.length,
    totalEligibleCount: groups.length,
    lastScheduledDate: lastScheduledGroup
      ? isoDateInAppTimezone(lastScheduledGroup.date)
      : null,
  };
}

function reminderSyncMessage(
  successPrefix: string,
  emptyMessage: string,
  result: ReminderSyncResult,
) {
  if (result.scheduledCount === 0) {
    return emptyMessage;
  }

  if (result.totalEligibleCount > result.scheduledCount) {
    return `${result.scheduledCount} reminder dates scheduled. More will schedule automatically as this device refreshes.`;
  }

  return `${successPrefix} ${result.scheduledCount} reminder${result.scheduledCount === 1 ? "" : "s"} scheduled.`;
}

export function BillReminderProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { ready, user } = useAuth();
  const previousUserIdRef = useRef<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [permissionStatus, setPermissionStatus] =
    useState<PermissionState>("unavailable");
  const [scheduledCount, setScheduledCount] = useState(0);
  const [totalEligibleReminderCount, setTotalEligibleReminderCount] =
    useState(0);
  const [lastScheduledReminderDate, setLastScheduledReminderDate] = useState<
    string | null
  >(null);
  const [syncing, setSyncing] = useState(false);
  const [providerReady, setProviderReady] = useState(false);

  useEffect(() => {
    void ensureNotificationChannel();
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const screen = response.notification.request.content.data?.screen;

        // Reminders scheduled before bills moved into Money still carry the
        // old screen value, so both spellings have to land in the same place.
        if (screen === "/bills" || screen === "/money?tab=bills") {
          router.push("/money?tab=bills");
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [router]);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      if (!ready) {
        return;
      }

      if (!user) {
        await cancelAllScheduledBillReminders();
        if (!active) return;
        setEnabled(false);
        setPermissionStatus(await getPermissionStatus());
        setScheduledCount(0);
        setTotalEligibleReminderCount(0);
        setLastScheduledReminderDate(null);
        setProviderReady(true);
        return;
      }

      const [nextEnabled, nextPermissionStatus] = await Promise.all([
        getUserReminderEnabled(user.id),
        getPermissionStatus(),
      ]);

      if (!active) return;

      setEnabled(nextEnabled);
      setPermissionStatus(nextPermissionStatus);

      if (nextEnabled && nextPermissionStatus === "granted") {
        setSyncing(true);

        try {
          const result = await syncRemindersForUser(user.id);
          if (!active) return;
          setScheduledCount(result.scheduledCount);
          setTotalEligibleReminderCount(result.totalEligibleCount);
          setLastScheduledReminderDate(result.lastScheduledDate);
        } catch {
          if (!active) return;
          const count = await getScheduledReminderCount(user.id);
          setScheduledCount(count);
          setTotalEligibleReminderCount(count);
          setLastScheduledReminderDate(null);
        } finally {
          if (active) {
            setSyncing(false);
          }
        }
      } else {
        await cancelScheduledRemindersForUser(user.id);
        setScheduledCount(0);
        setTotalEligibleReminderCount(0);
        setLastScheduledReminderDate(null);
      }

      previousUserIdRef.current = userKey(user.id);
      setProviderReady(true);
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [ready, user]);

  useEffect(() => {
    if (user) {
      previousUserIdRef.current = userKey(user.id);
      return;
    }

    if (!previousUserIdRef.current) {
      return;
    }

    void cancelAllScheduledBillReminders();
    previousUserIdRef.current = null;
  }, [user]);

  useEffect(() => {
    if (!user || !enabled || permissionStatus !== "granted") {
      return;
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        return;
      }

      void (async () => {
        setSyncing(true);

        try {
          const result = await syncRemindersForUser(user.id);
          setScheduledCount(result.scheduledCount);
          setTotalEligibleReminderCount(result.totalEligibleCount);
          setLastScheduledReminderDate(result.lastScheduledDate);
        } finally {
          setSyncing(false);
        }
      })();
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, permissionStatus, user]);

  const enableReminders = async () => {
    if (!user) {
      return {
        ok: false,
        message: "Sign in before turning on bill reminders.",
      };
    }

    await ensureNotificationChannel();

    const currentSettings = await Notifications.getPermissionsAsync();
    let finalStatus = currentSettings.status;

    if (finalStatus !== "granted") {
      const nextSettings = await Notifications.requestPermissionsAsync();
      finalStatus = nextSettings.status;
    }

    setPermissionStatus(finalStatus);

    if (finalStatus !== "granted") {
      await setUserReminderEnabled(user.id, false);
      setEnabled(false);
      setScheduledCount(0);
      setTotalEligibleReminderCount(0);
      setLastScheduledReminderDate(null);

      return {
        ok: false,
        message:
          "Notifications are off for Payday Planner. Allow them in device settings to get bill reminders.",
      };
    }

    setSyncing(true);

    try {
      await setUserReminderEnabled(user.id, true);
      const result = await syncRemindersForUser(user.id);
      setEnabled(true);
      setScheduledCount(result.scheduledCount);
      setTotalEligibleReminderCount(result.totalEligibleCount);
      setLastScheduledReminderDate(result.lastScheduledDate);

      return {
        ok: true,
        message: reminderSyncMessage(
          "Bill reminders are on.",
          "Bill reminders are on. New reminders will appear as upcoming bills enter the planning window.",
          result,
        ),
        sync: result,
      };
    } catch {
      await setUserReminderEnabled(user.id, false);
      setEnabled(false);
      setScheduledCount(0);
      setTotalEligibleReminderCount(0);
      setLastScheduledReminderDate(null);

      return {
        ok: false,
        message:
          "Notifications are allowed, but reminders could not be scheduled right now. Try again in a moment.",
      };
    } finally {
      setSyncing(false);
    }
  };

  const disableReminders = async () => {
    if (!user) {
      return;
    }

    setSyncing(true);

    try {
      await setUserReminderEnabled(user.id, false);
      await cancelScheduledRemindersForUser(user.id);
      setEnabled(false);
      setScheduledCount(0);
      setTotalEligibleReminderCount(0);
      setLastScheduledReminderDate(null);
    } finally {
      setSyncing(false);
    }
  };

  const refreshReminders = async () => {
    if (!user || !enabled || permissionStatus !== "granted") {
      return {
        ok: false,
        message: "Turn on bill reminders first to refresh the schedule.",
      };
    }

    setSyncing(true);

    try {
      const result = await syncRemindersForUser(user.id);
      setScheduledCount(result.scheduledCount);
      setTotalEligibleReminderCount(result.totalEligibleCount);
      setLastScheduledReminderDate(result.lastScheduledDate);

      return {
        ok: true,
        message: reminderSyncMessage(
          "Bill reminders refreshed.",
          "Bill reminders refreshed. No upcoming reminders are currently needed.",
          result,
        ),
        sync: result,
      };
    } catch {
      return {
        ok: false,
        message:
          "Reminders could not be refreshed right now. Try again in a moment.",
      };
    } finally {
      setSyncing(false);
    }
  };

  const openDeviceSettings = async () => {
    await Linking.openSettings();
  };

  return (
    <BillReminderContext.Provider
      value={{
        ready: providerReady,
        enabled,
        permissionStatus,
        scheduledCount,
        totalEligibleReminderCount,
        lastScheduledReminderDate,
        syncing,
        enableReminders,
        disableReminders,
        refreshReminders,
        openDeviceSettings,
      }}
    >
      {children}
    </BillReminderContext.Provider>
  );
}

export function useBillReminders() {
  const context = useContext(BillReminderContext);

  if (!context) {
    throw new Error(
      "useBillReminders must be used within a BillReminderProvider",
    );
  }

  return context;
}
