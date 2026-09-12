import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDueBillRows,
  fundingSourcesLabel,
  nextPaydaySummary,
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
      "$800 from Salary + $400 from Side income",
    );
    assert.equal(
      splitFundingLabel({ allocations: [] } as unknown as BillOccurrence),
      null,
    );
  });

  it("describes a single source for partially funded previews", () => {
    assert.equal(
      fundingSourcesLabel([{ amount: "400.00", name: "Salary" }]),
      "$400 from Salary",
    );
    assert.equal(fundingSourcesLabel([]), null);
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
