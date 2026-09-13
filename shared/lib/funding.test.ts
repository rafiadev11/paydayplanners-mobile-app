import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDueBillRows,
  currentPlanSummary,
  fundingSourcesLabel,
  nextPaydaySummary,
  planBalanceLabel,
  splitFundingLabel,
} from "@features/planning/funding";
import type { BillOccurrence, DashboardResponse } from "@features/planning/api";

describe("multiple income funding", () => {
  it("uses combined payday totals and retains both income sources", () => {
    const payday = {
      occurrence_date: "2026-04-01",
      effective_amount: "3000.00",
      assigned_total: "2400.00",
      savings_goal_total: "0.00",
      remaining_amount: "600.00",
      sources: [
        {
          id: 1,
          name: "Salary",
          effective_amount: "2000.00",
          assigned_total: "1600.00",
          savings_goal_total: "0.00",
          remaining_amount: "400.00",
        },
        {
          id: 2,
          name: "Side income",
          effective_amount: "1000.00",
          assigned_total: "800.00",
          savings_goal_total: "0.00",
          remaining_amount: "200.00",
        },
      ],
    };
    assert.equal(
      nextPaydaySummary({ next_payday: payday } as DashboardResponse),
      payday,
    );
  });

  it("supports older servers that return only the next paycheck", () => {
    const result = nextPaydaySummary({
      next_paycheck: {
        id: 1,
        occurrence_date: "2026-04-01",
        amount: "2000.00",
        status: "projected",
        assigned_total: "1600.00",
        savings_goal_total: "0.00",
        remaining_amount: "400.00",
      },
    } as DashboardResponse);
    assert.equal(result?.effective_amount, "2000.00");
    assert.equal(result?.sources.length, 1);
    assert.equal(
      nextPaydaySummary({ next_paycheck: null } as DashboardResponse),
      null,
    );
  });

  it("uses the current income pool across staggered paycheck dates", () => {
    const currentPlan = {
      effective_amount: "6400.00",
      assigned_total: "1154.00",
      savings_goal_total: "1000.00",
      remaining_amount: "4246.00",
      sources: [
        {
          id: 1,
          name: "Sunpower",
          occurrence_date: "2026-09-11",
          effective_amount: "4400.00",
          assigned_total: "1086.00",
          savings_goal_total: "0.00",
          remaining_amount: "3314.00",
        },
        {
          id: 2,
          name: "Tierria Paycheck",
          occurrence_date: "2026-09-15",
          effective_amount: "2000.00",
          assigned_total: "68.00",
          savings_goal_total: "1000.00",
          remaining_amount: "932.00",
        },
      ],
    };

    assert.equal(
      currentPlanSummary({ current_plan: currentPlan } as DashboardResponse),
      currentPlan,
    );
  });

  it("describes the balance after both bills and savings", () => {
    assert.equal(planBalanceLabel(4246), "left after bills & savings");
    assert.equal(planBalanceLabel(-154), "short after bills & savings");
  });

  it("describes every funding source and ignores zero allocations", () => {
    const bill = {
      allocations: [
        {
          id: 1,
          amount: "800.00",
          paycheck_occurrence_id: 1,
          paycheck_occurrence: { pay_schedule: { name: "Salary" } },
        },
        {
          id: 2,
          amount: "400.00",
          paycheck_occurrence_id: 2,
          paycheck_occurrence: { pay_schedule: { name: "Side income" } },
        },
        { id: 3, amount: "0.00", paycheck_occurrence_id: 3 },
      ],
    } as BillOccurrence;
    assert.equal(
      splitFundingLabel(bill),
      "$800.00 from Salary + $400.00 from Side income",
    );
    assert.equal(
      splitFundingLabel({ allocations: [] } as unknown as BillOccurrence),
      null,
    );
  });

  it("describes a single source for partially funded previews", () => {
    assert.equal(
      fundingSourcesLabel([{ amount: "400.00", name: "Salary" }]),
      "$400.00 from Salary",
    );
    assert.equal(fundingSourcesLabel([]), null);
  });

  it("keeps cent splits exact and dates duplicate schedule names", () => {
    assert.equal(
      fundingSourcesLabel([
        {
          amount: "812.50",
          name: "Salary",
          occurrence_date: "2026-04-01",
        },
        {
          amount: "437.50",
          name: "Salary",
          occurrence_date: "2026-04-15",
        },
      ]),
      "$812.50 from Salary (Wed, Apr 1) + $437.50 from Salary (Wed, Apr 15)",
    );
  });
});

it("merges payday bills without duplicates and preserves partial funding", () => {
  const bill = {
    id: 1,
    amount: "900.00",
    due_date: "2026-04-20",
    status: "projected",
    allocated_amount: "600.00",
    unfunded_amount: "300.00",
  } as BillOccurrence;
  const rows = buildDueBillRows({
    next_paycheck: null,
    next_payday_bill_occurrences: [bill],
    next_paycheck_bill_occurrences: [],
    bills_due_before_next_paycheck: [bill],
  } as unknown as DashboardResponse);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].unfunded, 300);
  assert.equal(rows[0].coveredBy, null);
});

it("prefers all current-plan bills over the next-payday subset", () => {
  const earlier = {
    id: 1,
    amount: "1086.00",
    due_date: "2026-09-20",
    status: "projected",
    unfunded_amount: "0.00",
  } as BillOccurrence;
  const nextPayday = {
    id: 2,
    amount: "68.00",
    due_date: "2026-09-15",
    status: "projected",
    unfunded_amount: "0.00",
  } as BillOccurrence;
  const rows = buildDueBillRows({
    next_paycheck: null,
    current_plan_bill_occurrences: [earlier, nextPayday],
    next_payday_bill_occurrences: [nextPayday],
    bills_due_before_next_paycheck: [],
  } as unknown as DashboardResponse);

  assert.deepEqual(
    rows.map((row) => row.id),
    ["2", "1"],
  );
});
