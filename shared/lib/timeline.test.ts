import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  BillOccurrence,
  DashboardResponse,
  ForecastPaycheck,
  ForecastResponse,
} from "@features/planning/api";
import { currentPlanSummary } from "@features/planning/funding";
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
  it("matches Home's current plan across staggered income dates and carries earlier income into the timeline", () => {
    const earlier = paycheck({
      id: 1,
      occurrence_date: "2026-10-23",
      amount: "4400.00",
      assigned_total: "657.00",
      savings_goal_total: "0.00",
      remaining_amount: "3743.00",
    });
    const next = paycheck({
      id: 2,
      occurrence_date: "2026-10-31",
      amount: "2000.00",
      assigned_total: "1170.00",
      savings_goal_total: "1000.00",
      remaining_amount: "-170.00",
    });
    const dashboard = {
      current_plan: {
        effective_amount: "6400.00",
        assigned_total: "1827.00",
        savings_goal_total: "1000.00",
        remaining_amount: "3573.00",
        sources: [earlier, next].map((p) => ({
          ...p,
          name: p.id === 1 ? "Sunpower" : "Tierria Paycheck",
          effective_amount: p.amount,
        })),
      },
    } as unknown as DashboardResponse;
    // The authoritative dashboard includes earlier income even when the
    // forecast window does not contain that paycheck (for example, month rollover).
    for (const paychecks of [[earlier, next], [next]]) {
      const result = buildTimeline(
        forecast(paychecks),
        "2026-10-29",
        dashboard,
      );
      assert.deepEqual(result.currentPlan, currentPlanSummary(dashboard));
      assert.equal(result.currentPlan?.remaining_amount, "3573.00");
      assert.equal(result.currentPlan?.sources.length, 2);
      assert.equal(result.paydays.length, 1);
      assert.equal(result.paydays[0].income, 2000);
      assert.equal(result.paydays[0].paydayRemaining, -170);
      assert.equal(result.paydays[0].carriedRemaining, 3743);
      assert.equal(result.paydays[0].remaining, 3573);
      assert.equal(
        Number(result.currentPlan?.remaining_amount),
        3743 + result.paydays[0].paydayRemaining,
      );
    }
  });

  it("carries deficits forward and only recovers when later income arrives", () => {
    const dashboard = {
      next_payday: { occurrence_date: "2026-10-31" },
      current_plan: {
        effective_amount: "6400.00",
        assigned_total: "1827.00",
        savings_goal_total: "5000.00",
        remaining_amount: "-427.00",
        sources: [],
      },
    } as unknown as DashboardResponse;
    const result = buildTimeline(
      forecast([
        paycheck({
          id: 2,
          occurrence_date: "2026-10-31",
          amount: "2000.00",
          assigned_total: "1170.00",
          savings_goal_total: "5000.00",
          remaining_amount: "-4170.00",
        }),
        paycheck({
          id: 3,
          occurrence_date: "2026-11-06",
          amount: "4400.00",
          assigned_total: "0.00",
          savings_goal_total: "0.00",
          remaining_amount: "4400.00",
        }),
      ]),
      "2026-10-29",
      dashboard,
    );
    assert.equal(result.currentPlan?.remaining_amount, "-427.00");
    assert.deepEqual(
      result.paydays.map((p) => p.remaining),
      [-427, 3973],
    );
    assert.deepEqual(
      result.paydays.map((p) => p.carriedRemaining),
      [3743, -427],
    );
    assert.equal(buildTimeline(forecast([]), "2026-10-29").currentPlan, null);
  });

  it("carries positive balances in cents without counting the first payday twice", () => {
    const dashboard = {
      next_payday: { occurrence_date: "2026-10-31" },
      current_plan: { remaining_amount: "3573.01", sources: [] },
    } as unknown as DashboardResponse;
    const input = forecast([
      paycheck({
        id: 1,
        occurrence_date: "2026-10-31",
        remaining_amount: "-170.00",
      }),
      paycheck({
        id: 2,
        occurrence_date: "2026-11-06",
        remaining_amount: "2729.02",
      }),
      paycheck({
        id: 3,
        occurrence_date: "2026-11-15",
        remaining_amount: "387.03",
      }),
      paycheck({
        id: 4,
        occurrence_date: "2026-11-20",
        remaining_amount: "900.00",
        status: "skipped",
      }),
    ]);
    const result = buildTimeline(input, "2026-10-29", dashboard);
    assert.deepEqual(
      result.paydays.map((p) => p.remaining),
      [3573.01, 6302.03, 6689.06],
    );
    assert.deepEqual(
      result.paydays.map((p) => p.carriedRemaining),
      [3743.01, 3573.01, 6302.03],
    );
    assert.equal(input.paychecks[0].remaining_amount, "-170.00");
    assert.equal(
      buildTimeline(input, "2026-10-29", dashboard).paydays[0].remaining,
      3573.01,
    );
  });

  it("does not attach the current plan to a forecast missing its next payday", () => {
    const dashboard = {
      next_payday: { occurrence_date: "2026-10-31" },
      current_plan: { remaining_amount: "3573.00", sources: [] },
    } as unknown as DashboardResponse;
    const result = buildTimeline(
      forecast([paycheck({ occurrence_date: "2026-11-06" })]),
      "2026-10-29",
      dashboard,
    );
    assert.equal(result.carriesPlan, false);
    assert.equal(result.paydays[0].remaining, 900);
    assert.equal(result.paydays[0].carriedRemaining, 0);
  });

  it("combines same-day incomes before applying carry, even with split bills and skipped sources", () => {
    const rent = bill({ id: 8, amount: "1800.00" });
    const input = forecast([
      paycheck({
        id: 3,
        occurrence_date: "2026-11-06",
        amount: "2000.00",
        assigned_total: "1000.00",
        savings_goal_total: "0.00",
        remaining_amount: "1000.00",
      }),
      paycheck({
        id: 2,
        occurrence_date: "2026-10-31",
        amount: "500.00",
        assigned_total: "600.00",
        savings_goal_total: "0.00",
        remaining_amount: "-100.00",
        assigned_bill_occurrences: [
          {
            allocation_id: 2,
            allocation_amount: "600.00",
            bill_occurrence: rent,
          },
        ],
      }),
      paycheck({
        id: 4,
        occurrence_date: "2026-10-31",
        amount: "9000.00",
        remaining_amount: "9000.00",
        status: "skipped",
      }),
      paycheck({
        id: 1,
        occurrence_date: "2026-10-31",
        amount: "1500.00",
        assigned_total: "1200.00",
        savings_goal_total: "300.00",
        remaining_amount: "0.00",
        assigned_bill_occurrences: [
          {
            allocation_id: 1,
            allocation_amount: "1200.00",
            bill_occurrence: rent,
          },
        ],
      }),
    ]);
    const dashboard = {
      next_payday: { occurrence_date: "2026-10-31" },
      current_plan: { remaining_amount: "700.00", sources: [] },
    } as unknown as DashboardResponse;
    const result = buildTimeline(input, "2026-10-29", dashboard);
    assert.deepEqual(
      result.paydays.map((day) => day.remaining),
      [700, 1700],
    );
    assert.equal(result.paydays[0].carriedRemaining, 800);
    assert.equal(result.paydays[0].income, 2000);
    assert.equal(result.paydays[0].billsTotal, 1800);
    assert.equal(result.paydays[0].bills.length, 1);
    assert.equal(result.paydays[0].bills[0].amount, 1800);
    assert.equal(result.paydays[0].sources.length, 2);
  });

  it("handles exact-zero balances and subsequent deficits without resetting carry", () => {
    const dashboard = {
      next_payday: { occurrence_date: "2026-10-31" },
      current_plan: { remaining_amount: "0.00", sources: [] },
    } as unknown as DashboardResponse;
    const result = buildTimeline(
      forecast([
        paycheck({
          id: 1,
          occurrence_date: "2026-10-31",
          remaining_amount: "-170.00",
        }),
        paycheck({
          id: 2,
          occurrence_date: "2026-11-06",
          remaining_amount: "-0.01",
        }),
        paycheck({
          id: 3,
          occurrence_date: "2026-11-15",
          remaining_amount: "0.01",
        }),
      ]),
      "2026-10-29",
      dashboard,
    );
    assert.equal(result.carriesPlan, true);
    assert.deepEqual(
      result.paydays.map((day) => day.remaining),
      [0, -0.01, 0],
    );
    assert.deepEqual(
      result.paydays.map((day) => day.carriedRemaining),
      [170, 0, -0.01],
    );
  });

  it("retains previous-month income when the calendar forecast starts in a new month", () => {
    const dashboard = {
      next_payday: { occurrence_date: "2026-11-02" },
      current_plan: {
        remaining_amount: "3573.00",
        sources: [
          { id: 1, occurrence_date: "2026-10-23", effective_amount: "4400.00" },
          { id: 2, occurrence_date: "2026-11-02", effective_amount: "2000.00" },
        ],
      },
    } as unknown as DashboardResponse;
    const result = buildTimeline(
      forecast([
        paycheck({
          id: 2,
          occurrence_date: "2026-11-02",
          remaining_amount: "-170.00",
        }),
      ]),
      "2026-11-01",
      dashboard,
    );
    assert.equal(result.paydays[0].carriedRemaining, 3743);
    assert.equal(result.paydays[0].remaining, 3573);
  });

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
