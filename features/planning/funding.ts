import type { BillOccurrence, DashboardResponse } from "@features/planning/api";
import { formatCurrencyPrecise, formatWeekdayDate } from "@shared/lib/format";

export type PaydaySummary = {
  occurrence_date: string;
  effective_amount: string;
  assigned_total: string;
  savings_goal_total: string;
  remaining_amount: string;
  sources: {
    id: number | string;
    name?: string | null;
    effective_amount: string;
  }[];
};

export function nextPaydaySummary(
  dashboard: DashboardResponse,
): PaydaySummary | null {
  if (dashboard.next_payday) return dashboard.next_payday;
  const paycheck = dashboard.next_paycheck;
  if (!paycheck) return null;
  return {
    occurrence_date: paycheck.occurrence_date,
    effective_amount: paycheck.effective_amount ?? paycheck.amount,
    assigned_total: paycheck.assigned_total,
    savings_goal_total: paycheck.savings_goal_total,
    remaining_amount: paycheck.remaining_amount,
    sources: [
      {
        id: paycheck.id,
        name: paycheck.pay_schedule?.name,
        effective_amount: paycheck.effective_amount ?? paycheck.amount,
      },
    ],
  };
}

export function splitFundingLabel(bill: BillOccurrence): string | null {
  const allocations =
    bill.allocations?.filter((allocation) => Number(allocation.amount) > 0) ??
    [];
  if (allocations.length < 2) return null;
  return fundingSourcesLabel(
    allocations.map((allocation) => ({
      amount: allocation.amount,
      name: allocation.paycheck_occurrence?.pay_schedule?.name,
      occurrence_date: allocation.paycheck_occurrence?.occurrence_date,
    })),
  );
}

export function fundingSourcesLabel(
  sources: {
    amount: string;
    name?: string | null;
    occurrence_date?: string | null;
  }[],
): string | null {
  if (!sources.length) return null;
  const labels = sources.map((source) => source.name ?? "paycheck");

  return sources
    .map((source, index) => {
      const label = labels[index];
      const repeated =
        labels.filter((candidate) => candidate === label).length > 1;
      const date =
        repeated && source.occurrence_date
          ? ` (${formatWeekdayDate(source.occurrence_date)})`
          : "";

      return `${formatCurrencyPrecise(source.amount)} from ${label}${date}`;
    })
    .join(" + ");
}

export type DueBillRow = {
  id: string;
  name: string;
  dueDate: string;
  amount: string;
  status: string;
  unfunded: number;
  coveredBy: string | null;
  splitFunding: string | null;
  isPlannedPurchase: boolean;
};

function toRow(
  occurrence: BillOccurrence,
  fallbackCoveredBy: string | null,
  hasFundingData: boolean,
): DueBillRow {
  // Allocation-backed dashboard rows omit funding totals on older servers. In
  // that fallback shape, treating a missing value as a shortfall would make a
  // covered bill appear unfunded.
  const unfunded = hasFundingData ? Number(occurrence.unfunded_amount ?? 0) : 0;
  const assignedDate = occurrence.assigned_paycheck_occurrence?.occurrence_date;

  return {
    id: String(occurrence.id),
    name: occurrence.bill?.name ?? "Bill",
    dueDate: occurrence.due_date,
    amount: occurrence.effective_amount ?? occurrence.amount,
    status: occurrence.status,
    splitFunding: splitFundingLabel(occurrence),
    unfunded,
    isPlannedPurchase: occurrence.bill?.kind === "planned_expense",
    coveredBy:
      unfunded > 0
        ? null
        : assignedDate
          ? formatWeekdayDate(assignedDate)
          : fallbackCoveredBy,
  };
}

export function buildDueBillRows(dashboard: DashboardResponse): DueBillRow[] {
  const payday = nextPaydaySummary(dashboard);
  const paydayLabel = payday ? formatWeekdayDate(payday.occurrence_date) : null;
  const rows = new Map<string, DueBillRow>();

  for (const occurrence of dashboard.next_payday_bill_occurrences ??
    dashboard.next_paycheck_bill_occurrences ??
    []) {
    const row = toRow(
      occurrence,
      paydayLabel,
      occurrence.unfunded_amount != null,
    );
    rows.set(row.id, row);
  }

  for (const occurrence of dashboard.bills_due_before_next_paycheck ?? []) {
    const row = toRow(occurrence, paydayLabel, true);
    rows.set(row.id, row);
  }

  return [...rows.values()]
    .filter((row) => row.status !== "skipped")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
