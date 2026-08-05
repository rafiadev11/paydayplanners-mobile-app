/**
 * Month arithmetic on bare `YYYY-MM` / `YYYY-MM-DD` strings.
 *
 * Every date is built at noon UTC and read back with `getUTC*`, the same
 * convention `addDaysToIsoDate` uses in `@shared/lib/timezone` — parsing a bare
 * date in local time drifts by a day across DST boundaries and in negative-offset
 * zones. Nothing here ever calls `new Date(isoString)`.
 */

const DAYS_IN_GRID = 42;

const monthNameFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

type MonthParts = {
  year: number;
  month: number;
};

function parseMonthKey(monthKey: string): MonthParts {
  const [year, month] = monthKey.split("-");

  return { year: Number(year), month: Number(month) };
}

function toIsoDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function utcNoon(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

/** `"2026-08-07"` -> `"2026-08"`. Also passes a month key through unchanged. */
export function monthKeyOf(value: string) {
  return value.slice(0, 7);
}

export function startOfMonthIso(monthKey: string) {
  return `${monthKeyOf(monthKey)}-01`;
}

export function endOfMonthIso(monthKey: string) {
  const { year, month } = parseMonthKey(monthKey);

  // Day 0 of the next month is the last day of this one.
  return toIsoDate(new Date(Date.UTC(year, month, 0, 12, 0, 0)));
}

export function addMonths(monthKey: string, count: number) {
  const { year, month } = parseMonthKey(monthKey);

  return monthKeyOf(toIsoDate(utcNoon(year, month + count, 1)));
}

export function compareMonths(left: string, right: string) {
  return monthKeyOf(left).localeCompare(monthKeyOf(right));
}

export function monthLabel(monthKey: string) {
  const { year, month } = parseMonthKey(monthKey);

  return monthNameFormatter.format(utcNoon(year, month, 1));
}

/**
 * The 42 cells of a Sunday-first month grid, including the leading and trailing
 * days that belong to the neighbouring months.
 */
export function monthGridDays(monthKey: string) {
  const { year, month } = parseMonthKey(monthKey);
  const first = utcNoon(year, month, 1);
  const leading = first.getUTCDay();
  const cells: { date: string; inMonth: boolean }[] = [];

  for (let index = 0; index < DAYS_IN_GRID; index += 1) {
    const cell = utcNoon(year, month, index - leading + 1);

    cells.push({
      date: toIsoDate(cell),
      inMonth: cell.getUTCMonth() === month - 1,
    });
  }

  return cells;
}
