import {
  type Bill,
  type PaycheckOccurrence,
  type PaySchedule,
} from "@features/planning/api";
import {
  formatDate,
  monthDayFromIsoDate,
  weekdayFromIsoDate,
} from "@shared/lib/format";
import { type RecurrenceFrequency } from "@shared/lib/recurrence";

const WEEKDAY_NAMES = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

const WEEKDAY_SINGULAR = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Chip copy for the frequency picker. Parallel grammar throughout — the older
 * labels mixed adverbs ("Weekly"), phrases ("Every 2 weeks") and nouns
 * ("One-time") in a single row.
 */
const FREQUENCY_CHIP_LABELS: Record<string, string> = {
  monthly: "Monthly",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  semimonthly: "Twice a month",
  yearly: "Yearly",
  once: "Just once",
};

export function frequencyChipLabel(frequency: string) {
  return FREQUENCY_CHIP_LABELS[frequency] ?? frequency;
}

function ordinal(day: number) {
  if (day >= 11 && day <= 13) return `${day}th`;

  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/** "the 15th" — or "the last day" for 31, which the backend treats as month-end. */
function monthDayPhrase(day: number) {
  return day >= 31 ? "the last day" : `the ${ordinal(day)}`;
}

/**
 * Restates the schedule the user just built, in place of asking them to
 * re-enter what the start date already implies. `verb` differs by domain —
 * bills repeat, paychecks arrive.
 */
export function recurrencePatternSentence(
  frequency: RecurrenceFrequency,
  startDate: string,
  options: { verb?: "Repeats" | "Paid"; secondMonthDay?: number | null } = {},
): string | null {
  const verb = options.verb ?? "Repeats";
  const monthDay = monthDayFromIsoDate(startDate);
  const weekday = weekdayFromIsoDate(startDate);

  switch (frequency) {
    case "once":
      return `Happens once, on ${formatDate(startDate)}`;
    case "weekly":
      return weekday == null
        ? null
        : `${verb} every ${WEEKDAY_SINGULAR[weekday]}`;
    case "biweekly":
      return weekday == null
        ? null
        : `${verb} every other ${WEEKDAY_SINGULAR[weekday]}`;
    case "yearly":
      return `${verb} every ${formatDate(startDate)}`;
    case "semimonthly": {
      if (monthDay == null) return null;

      const second = options.secondMonthDay ?? 31;

      if (second === monthDay) return null;

      const [first, last] = [monthDay, second].sort((a, b) => a - b);

      return `${verb} on ${monthDayPhrase(first)} and ${monthDayPhrase(last)} of each month`;
    }
    case "monthly":
      return monthDay == null
        ? null
        : `${verb} on ${monthDayPhrase(monthDay)} of each month`;
    default:
      return null;
  }
}

/** Warning that only applies when the chosen day does not exist in every month. */
export function shortMonthNote(
  frequency: RecurrenceFrequency,
  startDate: string,
) {
  if (frequency !== "monthly" && frequency !== "semimonthly") return null;

  const monthDay = monthDayFromIsoDate(startDate);

  return monthDay != null && monthDay >= 29 && monthDay < 31
    ? "Shorter months use their last day."
    : null;
}

/** Cadence in running-text form, e.g. `monthly, day 1` or `every 2 weeks`. */
export function billCadenceLabel(bill: Bill) {
  const interval =
    bill.interval_value && bill.interval_value > 1 ? bill.interval_value : 1;
  const weekday =
    bill.weekday != null ? WEEKDAY_NAMES[bill.weekday] : undefined;

  switch (bill.frequency) {
    case "monthly":
      return interval > 1
        ? `every ${interval} months${bill.due_day ? `, ${ordinal(bill.due_day)}` : ""}`
        : bill.due_day
          ? `monthly, ${ordinal(bill.due_day)}`
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

/**
 * Leads with the cadence and lands on the next real deposit date when the
 * forecast has generated one — a schedule with no occurrence falls back to the
 * rule itself rather than showing nothing.
 *
 * Cadence wording comes from `frequencyChipLabel`, the same source the income
 * form uses, so a schedule is never called "Biweekly" in one place and "Every 2
 * weeks" in another.
 */
export function incomeCadenceLabel(
  schedule: PaySchedule,
  nextOccurrence: PaycheckOccurrence | null | undefined,
) {
  const frequency = frequencyChipLabel(schedule.frequency);

  if (nextOccurrence) {
    // Row subtitles are single-line; the weekday is already on Home and in the
    // form, and keeping it here pushed the date past the truncation point.
    return `${frequency} · next ${formatDate(nextOccurrence.occurrence_date)}`;
  }

  if (schedule.frequency === "monthly" && schedule.month_day) {
    return `${frequency}, ${ordinal(schedule.month_day)}`;
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
