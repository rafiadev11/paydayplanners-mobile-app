import {
  type Bill,
  type PaycheckOccurrence,
  type PaySchedule,
} from "@features/planning/api";
import { formatWeekdayDate } from "@shared/lib/format";

const WEEKDAY_NAMES = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

/** Cadence in running-text form, e.g. `monthly, day 1` or `every 2 weeks`. */
export function billCadenceLabel(bill: Bill) {
  const interval =
    bill.interval_value && bill.interval_value > 1 ? bill.interval_value : 1;
  const weekday =
    bill.weekday != null ? WEEKDAY_NAMES[bill.weekday] : undefined;

  switch (bill.frequency) {
    case "monthly":
      return interval > 1
        ? `every ${interval} months${bill.due_day ? `, day ${bill.due_day}` : ""}`
        : bill.due_day
          ? `monthly, day ${bill.due_day}`
          : "monthly";
    case "weekly":
      return interval > 1
        ? `every ${interval} weeks${weekday ? `, ${weekday}` : ""}`
        : weekday
          ? `weekly, ${weekday}`
          : "weekly";
    case "biweekly":
      return weekday ? `every 2 weeks, ${weekday}` : "every 2 weeks";
    case "yearly":
      return interval > 1 ? `every ${interval} years` : "yearly";
    case "once":
      return "one-time";
    default:
      return bill.frequency;
  }
}

const INCOME_FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  semimonthly: "Semimonthly",
  monthly: "Monthly",
  once: "One-time",
};

/**
 * Leads with the cadence and lands on the next real deposit date when the
 * forecast has generated one — a schedule with no occurrence falls back to the
 * rule itself rather than showing nothing.
 */
export function incomeCadenceLabel(
  schedule: PaySchedule,
  nextOccurrence: PaycheckOccurrence | null | undefined,
) {
  const frequency =
    INCOME_FREQUENCY_LABELS[schedule.frequency] ?? schedule.frequency;

  if (nextOccurrence) {
    return `${frequency} · next ${formatWeekdayDate(nextOccurrence.occurrence_date)}`;
  }

  if (schedule.frequency === "monthly" && schedule.month_day) {
    return `${frequency}, day ${schedule.month_day}`;
  }

  if (schedule.frequency === "once") {
    return "One-time income";
  }

  return frequency;
}

/** The letter shown in a row's avatar. */
export function initialOf(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}
