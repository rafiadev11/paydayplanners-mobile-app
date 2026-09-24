import { billCadenceLabel } from "@features/money/labels";
import { formatDate, formatDateWithYear } from "@shared/lib/format";
import type { Bill } from "@features/planning/api";
import { monthlyEquivalent } from "@features/money/monthly";

export type BillSort = "amount" | "name" | "schedule" | "category";
export type BillGroupKey =
  | "monthly"
  | "yearly"
  | "other"
  | "once"
  | "unknown"
  | "planned";
const GROUPS: { key: BillGroupKey; title: string }[] = [
  { key: "monthly", title: "Monthly bills" },
  { key: "yearly", title: "Yearly bills" },
  { key: "other", title: "Other recurring bills" },
  { key: "once", title: "One-time bills" },
  { key: "unknown", title: "Other bills" },
  { key: "planned", title: "Planned purchases" },
];
export function billGroupKey(bill: Bill): BillGroupKey {
  if (bill.kind === "planned_expense") return "planned";
  if (
    bill.frequency === "monthly" ||
    bill.frequency === "yearly" ||
    bill.frequency === "once"
  )
    return bill.frequency;
  if (["weekly", "biweekly", "semimonthly"].includes(bill.frequency))
    return "other";
  return "unknown";
}
export function categoryName(bill: Bill) {
  return bill.bill_category?.name ?? "Uncategorized";
}
function scheduleKey(bill: Bill) {
  switch (bill.frequency) {
    case "monthly":
      return String(
        bill.due_day ?? Number(bill.start_date.slice(8, 10)),
      ).padStart(2, "0");
    case "yearly":
      return bill.start_date.slice(5);
    case "weekly":
    case "biweekly":
      return String(bill.weekday ?? 7);
    default:
      return bill.start_date;
  }
}
export function buildBillGroups(bills: Bill[], sort: BillSort) {
  return GROUPS.map(({ key, title }) => {
    const rows = bills
      .filter((bill) => billGroupKey(bill) === key)
      .sort((a, b) => {
        const tie =
          a.name.localeCompare(b.name) ||
          String(a.id).localeCompare(String(b.id));
        if (key === "planned")
          return a.start_date.localeCompare(b.start_date) || tie;
        const status = Number(b.is_active) - Number(a.is_active);
        if (status) return status;
        switch (sort) {
          case "amount":
            return Number(b.amount) - Number(a.amount) || tie;
          case "category":
            return categoryName(a).localeCompare(categoryName(b)) || tie;
          case "schedule":
            return scheduleKey(a).localeCompare(scheduleKey(b)) || tie;
          default:
            return tie;
        }
      });
    const active = rows.filter((bill) => bill.is_active);
    return {
      key,
      title,
      rows,
      activeCount: active.length,
      pausedCount: rows.length - active.length,
      total: active.reduce((sum, bill) => sum + Number(bill.amount), 0),
      monthly: active.reduce(
        (sum, bill) =>
          sum +
          monthlyEquivalent(bill.amount, bill.frequency, bill.interval_value),
        0,
      ),
    };
  }).filter((group) => group.rows.length > 0);
}

/** Reopen destinations after a new bill or cadence edit; refresh alone changes nothing. */
export function changedBillGroups(previous: Bill[], current: Bill[]) {
  const prior = new Map(
    previous.map((bill) => [String(bill.id), billGroupKey(bill)]),
  );
  return new Set(
    current
      .filter((bill) => prior.get(String(bill.id)) !== billGroupKey(bill))
      .map(billGroupKey),
  );
}

export function billListScheduleLabel(bill: Bill) {
  if (bill.kind === "planned_expense")
    return `Planned for ${formatDateWithYear(bill.start_date)}`;
  if (bill.frequency === "yearly")
    return `Yearly · scheduled ${formatDate(bill.start_date)}`;
  if (bill.frequency === "monthly") {
    const day = bill.due_day ?? Number(bill.start_date.slice(8, 10));
    if (day === 31) return "Monthly · last day of the month";
    return billCadenceLabel({
      ...bill,
      interval_value: null,
      due_day: day,
    });
  }
  if (bill.frequency === "once")
    return `One-time · ${formatDateWithYear(bill.start_date)}`;
  if (bill.frequency === "biweekly" && (bill.interval_value ?? 2) > 2)
    return `Every ${bill.interval_value} weeks`;
  if (bill.frequency === "semimonthly") return "Twice a month";
  return billCadenceLabel(bill);
}
