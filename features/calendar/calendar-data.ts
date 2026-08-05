import {
  type BillOccurrence,
  type ForecastPaycheck,
  type ForecastResponse,
} from "@features/planning/api";
import { formatCurrency, formatDate } from "@shared/lib/format";
import { monthKeyOf } from "@shared/lib/month";

/**
 * Everything happening on one date, already reduced to the numbers the grid and
 * the day detail render.
 *
 * Totals follow the same rules the backend uses in `BuildForecastAction`:
 * skipped paychecks contribute no income and skipped bills count against
 * nothing. Skipped items still appear in `paychecks` / `bills` so the day detail
 * can show them greyed out — a day whose only bill was skipped should say so,
 * not look empty.
 */
export type CalendarDay = {
  date: string;
  paychecks: ForecastPaycheck[];
  bills: BillOccurrence[];
  incomeTotal: number;
  billsTotal: number;
  savingsTotal: number;
  hasShortfall: boolean;
};

export type MonthSummary = {
  incomeTotal: number;
  billsTotal: number;
  savingsTotal: number;
  outTotal: number;
  yoursTotal: number;
};

export type NextEvent = {
  kind: "paycheck" | "bill";
  date: string;
};

export type CalendarDayMap = Map<string, CalendarDay>;

function emptyDay(date: string): CalendarDay {
  return {
    date,
    paychecks: [],
    bills: [],
    incomeTotal: 0,
    billsTotal: 0,
    savingsTotal: 0,
    hasShortfall: false,
  };
}

function dayFor(days: CalendarDayMap, date: string) {
  let day = days.get(date);

  if (!day) {
    day = emptyDay(date);
    days.set(date, day);
  }

  return day;
}

export function billAmount(bill: BillOccurrence) {
  return Number(bill.effective_amount ?? bill.amount ?? 0);
}

export function paycheckAmount(paycheck: ForecastPaycheck) {
  return Number(paycheck.effective_amount ?? paycheck.amount ?? 0);
}

export function unfundedAmount(bill: BillOccurrence) {
  return Number(bill.unfunded_amount ?? 0);
}

export function isBillShort(bill: BillOccurrence) {
  if (bill.status === "paid" || bill.status === "skipped") {
    return false;
  }

  return unfundedAmount(bill) > 0 || bill.status === "overdue";
}

/**
 * Bills are read only from the flat `bill_occurrences` list. The same occurrence
 * also appears under `paychecks[].assigned_bill_occurrences`; walking both would
 * count every covered bill twice.
 */
export function buildDayMap(forecast: ForecastResponse): CalendarDayMap {
  const days: CalendarDayMap = new Map();

  for (const paycheck of forecast.paychecks) {
    const day = dayFor(days, paycheck.occurrence_date);
    day.paychecks.push(paycheck);

    if (paycheck.status === "skipped") {
      continue;
    }

    day.incomeTotal += paycheckAmount(paycheck);
    // Goal contributions leave the account on the payday that funds them.
    day.savingsTotal += Number(paycheck.savings_goal_total ?? 0);
  }

  for (const bill of forecast.bill_occurrences) {
    const day = dayFor(days, bill.due_date);
    day.bills.push(bill);

    if (bill.status === "skipped") {
      continue;
    }

    day.billsTotal += billAmount(bill);
    day.hasShortfall ||= isBillShort(bill);
  }

  for (const day of days.values()) {
    day.paychecks.sort((left, right) =>
      String(left.id).localeCompare(String(right.id)),
    );
    // Biggest bill first — it is the one that decides whether the day hurts.
    day.bills.sort((left, right) => billAmount(right) - billAmount(left));
  }

  return days;
}

export function buildMonthSummary(
  days: CalendarDayMap,
  monthKey: string,
): MonthSummary {
  let incomeTotal = 0;
  let billsTotal = 0;
  let savingsTotal = 0;

  for (const day of days.values()) {
    if (monthKeyOf(day.date) !== monthKey) {
      continue;
    }

    incomeTotal += day.incomeTotal;
    billsTotal += day.billsTotal;
    savingsTotal += day.savingsTotal;
  }

  const outTotal = billsTotal + savingsTotal;

  return {
    incomeTotal,
    billsTotal,
    savingsTotal,
    outTotal,
    yoursTotal: incomeTotal - outTotal,
  };
}

/**
 * The first and last dates income lands in this window. A bill outside those
 * bounds is short for a reason the user can act on — income has not started yet,
 * or is not scheduled that far out — rather than because money ran out.
 */
export type PaycheckBounds = {
  first: string | null;
  last: string | null;
};

export function paycheckBounds(forecast: ForecastResponse): PaycheckBounds {
  const dates = forecast.paychecks
    .filter((paycheck) => paycheck.status !== "skipped")
    .map((paycheck) => paycheck.occurrence_date)
    .sort((left, right) => left.localeCompare(right));

  return {
    first: dates[0] ?? null,
    last: dates[dates.length - 1] ?? null,
  };
}

/** Whether the forecast window holds nothing at all — a brand new account. */
export function hasAnyActivity(forecast: ForecastResponse) {
  return forecast.paychecks.length > 0 || forecast.bill_occurrences.length > 0;
}

/**
 * The soonest thing after `fromDate`, so an empty day can name what comes next
 * instead of leaving the user staring at a blank card.
 */
export function findNextEventAfter(
  days: CalendarDayMap,
  fromDate: string,
  kind?: NextEvent["kind"],
): NextEvent | null {
  let best: NextEvent | null = null;

  for (const day of days.values()) {
    if (day.date <= fromDate) {
      continue;
    }

    if (best && day.date >= best.date) {
      continue;
    }

    const hasBill = day.bills.some((bill) => bill.status !== "skipped");
    const hasPaycheck = day.paychecks.some(
      (paycheck) => paycheck.status !== "skipped",
    );

    if (kind === "bill" && !hasBill) continue;
    if (kind === "paycheck" && !hasPaycheck) continue;
    if (!kind && !hasBill && !hasPaycheck) continue;

    best = {
      date: day.date,
      kind: kind ?? (hasPaycheck && !hasBill ? "paycheck" : "bill"),
    };
  }

  return best;
}

/** Sentence read aloud for a grid cell, e.g. "August 7, today, paycheck $2,140, 1 bill due, $85". */
export function dayAccessibilityLabel(
  date: string,
  day: CalendarDay | undefined,
  options: { isToday: boolean; isSelected: boolean },
) {
  const parts = [formatDate(date)];

  if (options.isToday) {
    parts.push("today");
  }

  if (day && day.incomeTotal > 0) {
    parts.push(`paycheck ${formatCurrency(day.incomeTotal)}`);
  }

  const billCount =
    day?.bills.filter((bill) => bill.status !== "skipped").length ?? 0;

  if (billCount > 0) {
    parts.push(
      `${billCount} ${billCount === 1 ? "bill" : "bills"} due, ${formatCurrency(day?.billsTotal ?? 0)}`,
    );
  }

  if (day?.hasShortfall) {
    parts.push("not fully covered");
  }

  if (!day || (day.incomeTotal === 0 && billCount === 0)) {
    parts.push("nothing scheduled");
  }

  if (options.isSelected) {
    parts.push("selected");
  }

  return parts.join(", ");
}
