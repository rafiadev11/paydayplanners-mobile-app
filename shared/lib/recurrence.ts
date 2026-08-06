/**
 * Projects the next few dates a schedule will land on, so a form can show what
 * the user just described before they save it.
 *
 * This mirrors `web/app/Support/RecurringDateGenerator.php`, which owns the
 * truth — the server still generates every occurrence. Keep the two in step:
 * the day-clamping rule (`monthlyOccurrenceForMonth`) and the semimonthly
 * two-days-per-month sweep are copied deliberately, not approximated.
 *
 * All arithmetic runs at noon UTC, the same convention as `@shared/lib/month`,
 * because parsing a bare `YYYY-MM-DD` in local time drifts a day across DST and
 * in negative-offset zones.
 */

export type RecurrenceFrequency =
  | "once"
  | "weekly"
  | "biweekly"
  | "semimonthly"
  | "monthly"
  | "yearly";

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate?: string | null;
  /**
   * Day of the month the rule actually lands on, when it differs from the start
   * date's own day. Stored records routinely do — a bill can start on Jan 1 and
   * be due on the 6th — so reading one back must honour it rather than assuming
   * the start date implies the day.
   */
  monthDay?: number | null;
  /** Weekly and biweekly, same idea: the stored weekday wins over the start date's. */
  weekday?: number | null;
  /** Semimonthly only — the second pay day. 31 means "last day of the month". */
  secondMonthDay?: number | null;
  /**
   * Skip past dates before this one, the way the generator's `$windowStart`
   * does. A bill that started in January still repeats; what a user needs to
   * see is the next few, not the ones already gone.
   */
  notBefore?: string | null;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function parseIso(value: string): DateParts | null {
  const match = ISO_DATE.exec(value.trim());

  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function utcNoon(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function toIso(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate();
}

/** `monthlyOccurrenceForMonth` — the 31st becomes the 30th or the 28th. */
function occurrenceInMonth(year: number, month: number, targetDay: number) {
  return utcNoon(year, month, Math.min(targetDay, daysInMonth(year, month)));
}

function clampDay(value: number) {
  return Math.max(1, Math.min(31, value));
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);

  return next;
}

/**
 * The date a stored rule actually first lands on — which is not the same as its
 * `start_date` whenever `monthDay` or `weekday` points elsewhere. Editing a
 * record must show this, not the raw start date, or the form would misdescribe
 * the schedule and rewrite it on save.
 */
export function firstOccurrenceOf(rule: RecurrenceRule): string | null {
  return nextOccurrences(rule, 1)[0] ?? null;
}

/**
 * The next `count` dates on or after the rule's start date, as ISO strings.
 * Returns fewer when an end date cuts the series short, and none when the rule
 * is incomplete.
 */
export function nextOccurrences(rule: RecurrenceRule, count = 3): string[] {
  const start = parseIso(rule.startDate);

  if (!start || count < 1) return [];

  const startIso = rule.startDate.trim();
  const endIso = rule.endDate ? parseIso(rule.endDate) : null;
  const endLimit = endIso ? rule.endDate!.trim() : null;

  const withinEnd = (iso: string) => endLimit === null || iso <= endLimit;
  const floor =
    rule.notBefore && parseIso(rule.notBefore)
      ? rule.notBefore.trim()
      : startIso;
  const started = (iso: string) => iso >= startIso && iso >= floor;

  if (rule.frequency === "once") {
    return withinEnd(startIso) && started(startIso) ? [startIso] : [];
  }

  if (rule.frequency === "weekly" || rule.frequency === "biweekly") {
    const step = rule.frequency === "biweekly" ? 14 : 7;
    const dates: string[] = [];
    let cursor = utcNoon(start.year, start.month, start.day);

    // `$currentDate->next($weekday)` — advance to the stored weekday first.
    if (rule.weekday != null && cursor.getUTCDay() !== rule.weekday) {
      const delta = (rule.weekday - cursor.getUTCDay() + 7) % 7;
      cursor = addDays(cursor, delta === 0 ? 7 : delta);
    }

    let guard = 0;

    while (dates.length < count && guard < 5000) {
      guard += 1;

      const iso = toIso(cursor);

      if (!withinEnd(iso)) break;

      if (started(iso)) dates.push(iso);

      cursor = addDays(cursor, step);
    }

    return dates;
  }

  if (rule.frequency === "yearly") {
    const dates: string[] = [];
    let year = start.year;
    let guard = 0;

    while (dates.length < count && guard < 200) {
      guard += 1;

      const iso = toIso(occurrenceInMonth(year, start.month, start.day));

      if (!withinEnd(iso)) break;

      if (started(iso)) dates.push(iso);

      year += 1;
    }

    return dates;
  }

  const primaryDay = clampDay(rule.monthDay ?? start.day);
  const targetDays =
    rule.frequency === "semimonthly"
      ? [...new Set([primaryDay, clampDay(rule.secondMonthDay ?? 31)])].sort(
          (left, right) => left - right,
        )
      : [primaryDay];

  const dates: string[] = [];
  let year = start.year;
  let month = start.month;
  // A monthly rule whose target day precedes the start date begins next month.
  let guard = 0;

  while (dates.length < count && guard < 1200) {
    guard += 1;

    for (const targetDay of targetDays) {
      if (dates.length >= count) break;

      const iso = toIso(occurrenceInMonth(year, month, targetDay));

      if (!started(iso)) continue;
      if (!withinEnd(iso)) return dates;

      dates.push(iso);
    }

    month += 1;

    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return dates;
}
