import type {
  BillOccurrence,
  ForecastPaycheck,
  ForecastResponse,
} from "@features/planning/api";
import { addDaysToIsoDate } from "@shared/lib/timezone";

// Aggregate in cents so combining income sources never introduces rounding drift.
const cents = (value: string | undefined) =>
  Math.round(Number(value ?? 0) * 100);

export type TimelineBill = { bill: BillOccurrence; amount: number };
export type TimelinePayday = {
  date: string;
  income: number;
  billsTotal: number;
  savings: number;
  remaining: number;
  sources: ForecastPaycheck[];
  bills: TimelineBill[];
  goals: { id: string; name: string; amount: number }[];
};

export function buildTimeline(forecast: ForecastResponse, today: string) {
  const end = addDaysToIsoDate(today, 90);
  const grouped = new Map<string, ForecastPaycheck[]>();
  for (const paycheck of forecast.paychecks) {
    if (
      paycheck.status === "skipped" ||
      paycheck.occurrence_date < today ||
      paycheck.occurrence_date > end
    )
      continue;
    const sources = grouped.get(paycheck.occurrence_date) ?? [];
    sources.push(paycheck);
    grouped.set(paycheck.occurrence_date, sources);
  }
  const paydays: TimelinePayday[] = [...grouped]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sources]) => {
      const bills = new Map<string, { bill: BillOccurrence; amount: number }>();
      const goals = new Map<
        string,
        { id: string; name: string; amount: number }
      >();
      const allocations = new Set<string>();
      for (const source of sources) {
        for (const allocation of source.assigned_bill_occurrences) {
          const bill = allocation.bill_occurrence;
          const key = String(allocation.allocation_id);
          if (bill.status === "skipped" || allocations.has(key)) continue;
          allocations.add(key);
          const row = bills.get(String(bill.id)) ?? { bill, amount: 0 };
          row.amount += cents(allocation.allocation_amount);
          bills.set(String(bill.id), row);
        }
        for (const goal of source.savings_goal_contributions) {
          const id = String(goal.savings_goal_id);
          const row = goals.get(id) ?? { id, name: goal.name, amount: 0 };
          row.amount += cents(goal.amount);
          goals.set(id, row);
        }
      }
      return {
        date,
        sources,
        income:
          sources.reduce(
            (sum, p) => sum + cents(p.effective_amount ?? p.amount),
            0,
          ) / 100,
        billsTotal:
          sources.reduce((sum, p) => sum + cents(p.assigned_total), 0) / 100,
        savings:
          sources.reduce((sum, p) => sum + cents(p.savings_goal_total), 0) /
          100,
        remaining:
          sources.reduce((sum, p) => sum + cents(p.remaining_amount), 0) / 100,
        bills: [...bills.values()]
          .sort(
            (a, b) =>
              a.bill.due_date.localeCompare(b.bill.due_date) ||
              String(a.bill.id).localeCompare(String(b.bill.id)),
          )
          .map((row) => ({ ...row, amount: row.amount / 100 })),
        goals: [...goals.values()].map((row) => ({
          ...row,
          amount: row.amount / 100,
        })),
      };
    });
  // A projected occurrence does not automatically become "overdue" on the
  // server. Keep every unpaid funding gap returned in the forecast, including
  // past due dates, until it is funded, paid, or skipped.
  const uncovered = [
    ...new Map(
      [
        ...forecast.unassigned_bill_occurrences,
        ...forecast.bill_occurrences,
      ].map((bill) => [String(bill.id), bill]),
    ).values(),
  ]
    .filter(
      (bill) =>
        bill.status !== "paid" &&
        bill.status !== "skipped" &&
        bill.due_date <= end &&
        (Number(bill.unfunded_amount ?? 0) > 0 ||
          (bill.unfunded_amount == null &&
            !bill.assigned_paycheck_occurrence_id &&
            !bill.allocations?.length)),
    )
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  return { paydays, uncovered, end };
}

export function selectedPaydayIndex(
  paydays: TimelinePayday[],
  date: string | null,
) {
  const index = paydays.findIndex((payday) => payday.date === date);
  return Math.max(0, index);
}
