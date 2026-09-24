import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  BillOccurrence,
  ForecastPaycheck,
  ForecastResponse,
} from "@features/planning/api";
import { buildTimeline, selectedPaydayIndex } from "@features/timeline/model";

function paycheck(overrides: Partial<ForecastPaycheck> = {}): ForecastPaycheck {
  return {
    id: 1,
    occurrence_date: "2026-09-25",
    amount: "2400.00",
    status: "projected",
    assigned_total: "1200.00",
    savings_goal_total: "300.00",
    remaining_amount: "900.00",
    assigned_bill_occurrences: [],
    savings_goal_contributions: [],
    ...overrides,
  };
}
function bill(overrides: Partial<BillOccurrence> = {}): BillOccurrence {
  return {
    id: 1,
    due_date: "2026-10-01",
    amount: "1200.00",
    status: "projected",
    unfunded_amount: "0.00",
    ...overrides,
  };
}
function forecast(
  paychecks: ForecastPaycheck[],
  bills: BillOccurrence[] = [],
  unassigned: BillOccurrence[] = [],
): ForecastResponse {
  return {
    paychecks,
    bill_occurrences: bills,
    unassigned_bill_occurrences: unassigned,
  } as ForecastResponse;
}

describe("money timeline", () => {
  it("keeps past-due projected bills visible until paid or skipped", () => {
    const result = buildTimeline(
      forecast(
        [paycheck()],
        [
          bill({
            id: 10,
            due_date: "2026-09-22",
            status: "projected",
            unfunded_amount: "85.00",
          }),
          bill({
            id: 11,
            due_date: "2026-09-22",
            status: "paid",
            unfunded_amount: "85.00",
          }),
          bill({
            id: 12,
            due_date: "2026-09-22",
            status: "skipped",
            unfunded_amount: "85.00",
          }),
        ],
      ),
      "2026-09-24",
    );
    assert.deepEqual(
      result.uncovered.map((row) => row.id),
      [10],
    );
  });

  it("retains the selected date across a refreshed forecast with inserted paydays", () => {
    const selected = "2026-10-09";
    const before = buildTimeline(
      forecast([paycheck(), paycheck({ id: 2, occurrence_date: selected })]),
      "2026-09-24",
    ).paydays;
    const after = buildTimeline(
      forecast([
        paycheck(),
        paycheck({ id: 3, occurrence_date: "2026-10-02" }),
        paycheck({ id: 2, occurrence_date: selected }),
      ]),
      "2026-09-24",
    ).paydays;
    assert.equal(before[selectedPaydayIndex(before, selected)].date, selected);
    assert.equal(after[selectedPaydayIndex(after, selected)].date, selected);
  });

  it("combines same-day income, allocations and goal contributions without counting whole split bills twice", () => {
    const rent = bill();
    const result = buildTimeline(
      forecast([
        paycheck({
          assigned_total: "800.10",
          savings_goal_total: "100.05",
          remaining_amount: "1499.85",
          assigned_bill_occurrences: [
            {
              allocation_id: 1,
              allocation_amount: "800.10",
              bill_occurrence: rent,
            },
          ],
          savings_goal_contributions: [
            {
              savings_goal_id: 1,
              name: "Buffer",
              amount: "100.05",
              priority: 1,
            },
          ],
        }),
        paycheck({
          id: 2,
          amount: "500.00",
          assigned_total: "199.90",
          savings_goal_total: "49.95",
          remaining_amount: "250.15",
          assigned_bill_occurrences: [
            {
              allocation_id: 2,
              allocation_amount: "199.90",
              bill_occurrence: rent,
            },
          ],
          savings_goal_contributions: [
            {
              savings_goal_id: 1,
              name: "Buffer",
              amount: "49.95",
              priority: 1,
            },
          ],
        }),
      ]),
      "2026-09-24",
    );
    assert.equal(result.paydays.length, 1);
    const day = result.paydays[0];
    assert.equal(day.income, 2900);
    assert.equal(day.billsTotal, 1000);
    assert.equal(day.savings, 150);
    assert.equal(day.remaining, 1750);
    assert.equal(day.bills.length, 1);
    assert.equal(day.bills[0].amount, 1000);
    assert.equal(day.goals[0].amount, 150);
    assert.equal(day.sources.length, 2);
  });

  it("shows each payday's share of a bill funded across different dates", () => {
    const rent = bill();
    const days = buildTimeline(
      forecast([
        paycheck({
          assigned_bill_occurrences: [
            {
              allocation_id: 1,
              allocation_amount: "700.00",
              bill_occurrence: rent,
            },
          ],
        }),
        paycheck({
          id: 2,
          occurrence_date: "2026-09-30",
          assigned_bill_occurrences: [
            {
              allocation_id: 2,
              allocation_amount: "500.00",
              bill_occurrence: rent,
            },
          ],
        }),
      ]),
      "2026-09-24",
    ).paydays;
    assert.deepEqual(
      days.map((day) => day.bills[0].amount),
      [700, 500],
    );
  });

  it("sorts paydays and includes today and the 90-day boundary, excluding skipped and out-of-range income", () => {
    const { paydays, end } = buildTimeline(
      forecast([
        paycheck({ id: 5, occurrence_date: "2026-12-24" }),
        paycheck({ id: 4, occurrence_date: "2026-12-23" }),
        paycheck({ id: 3, occurrence_date: "2026-09-25", status: "skipped" }),
        paycheck({ id: 2, occurrence_date: "2026-09-23" }),
        paycheck({ id: 1, occurrence_date: "2026-09-24" }),
      ]),
      "2026-09-24",
    );
    assert.equal(end, "2026-12-23");
    assert.deepEqual(
      paydays.map((day) => day.date),
      ["2026-09-24", "2026-12-23"],
    );
  });

  it("keeps paid allocations in the budget, excludes skipped bills and deduplicates allocation IDs", () => {
    const paid = {
      allocation_id: 1,
      allocation_amount: "1200.00",
      bill_occurrence: bill({ status: "paid" }),
    };
    const day = buildTimeline(
      forecast([
        paycheck({
          assigned_bill_occurrences: [
            paid,
            paid,
            {
              allocation_id: 2,
              allocation_amount: "100.00",
              bill_occurrence: bill({ id: 2, status: "skipped" }),
            },
          ],
        }),
      ]),
      "2026-09-24",
    ).paydays[0];
    assert.equal(day.bills.length, 1);
    assert.equal(day.bills[0].amount, 1200);
  });

  it("surfaces partial funding independently of positive remaining amounts and excludes paid, skipped and distant gaps", () => {
    const partial = bill({
      unfunded_amount: "85.00",
      assigned_paycheck_occurrence_id: 1,
    });
    const late = bill({
      id: 2,
      due_date: "2026-09-20",
      status: "overdue",
      unfunded_amount: "20.00",
    });
    const result = buildTimeline(
      forecast(
        [paycheck()],
        [
          partial,
          late,
          bill({ id: 3, status: "paid", unfunded_amount: "100.00" }),
          bill({ id: 4, status: "skipped", unfunded_amount: "100.00" }),
          bill({ id: 5, due_date: "2027-01-01", unfunded_amount: "100.00" }),
        ],
        [partial],
      ),
      "2026-09-24",
    );
    assert.equal(result.paydays[0].remaining, 900);
    assert.deepEqual(
      result.uncovered.map((row) => row.id),
      [2, 1],
    );
  });

  it("keeps server shortfall amounts and falls back to the next payday if the selection disappears", () => {
    const result = buildTimeline(
      forecast([paycheck({ remaining_amount: "-85.01" })]),
      "2026-09-24",
    );
    assert.equal(result.paydays[0].remaining, -85.01);
    assert.equal(selectedPaydayIndex(result.paydays, "2026-09-30"), 0);
    assert.deepEqual(buildTimeline(forecast([]), "2026-09-24").paydays, []);
  });
});
