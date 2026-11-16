import { dateAtTimeInAppTimezone } from "../../shared/lib/timezone";

export type PaydayPreferences = {
  enabled: boolean;
  dayBefore: boolean;
  hour: number;
  minute: number;
};
export const defaultPaydayPreferences: PaydayPreferences = {
  enabled: false,
  dayBefore: false,
  hour: 9,
  minute: 0,
};
export function parsePaydayPreferences(raw: string | null): PaydayPreferences {
  try {
    const value = JSON.parse(raw ?? "{}");
    return {
      enabled: value.enabled === true,
      dayBefore: value.dayBefore === true,
      hour:
        Number.isInteger(value.hour) && value.hour >= 0 && value.hour <= 23
          ? value.hour
          : 9,
      minute:
        Number.isInteger(value.minute) &&
        value.minute >= 0 &&
        value.minute <= 59
          ? value.minute
          : 0,
    };
  } catch {
    return { ...defaultPaydayPreferences };
  }
}
export function buildPaydayReminders(
  paychecks: { occurrence_date: string; status: string }[],
  preferences: PaydayPreferences,
  now = new Date(),
) {
  const dates = new Set(
    paychecks
      .filter((p) => p.status !== "skipped" && p.status !== "cancelled")
      .map((p) => p.occurrence_date),
  );
  return [...dates]
    .sort()
    .flatMap((payday) => {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(payday) ||
        !Number.isFinite(new Date(`${payday}T12:00:00Z`).getTime()) ||
        new Date(`${payday}T12:00:00Z`).toISOString().slice(0, 10) !== payday
      )
        return [];
      const date = dateAtTimeInAppTimezone(
        payday,
        preferences.hour,
        preferences.minute,
        preferences.dayBefore ? -1 : 0,
      );
      return date && date > now ? [{ payday, date }] : [];
    })
    .slice(0, 20);
}
