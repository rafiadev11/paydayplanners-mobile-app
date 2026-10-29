import assert from "node:assert/strict";
import { it } from "node:test";
import { savingsPaydays } from "@features/goals/savings-paydays";

it("keeps an unconfirmed past payday available alongside future plans", () => {
  const recent = {
    paycheck_occurrence_id: 1,
    occurrence_date: "2026-01-02",
    amount: "",
  };
  const future = {
    paycheck_occurrence_id: 2,
    occurrence_date: "2026-01-16",
    amount: "100.00",
  };
  assert.deepEqual(savingsPaydays([recent], [future], []), [recent, future]);
  assert.deepEqual(savingsPaydays([recent], [], []), [recent]);
});
it("hides confirmed paydays, removes overlapping plans, and restores undone entries", () => {
  const payday = {
    paycheck_occurrence_id: 1,
    occurrence_date: "2026-01-02",
    amount: "100.00",
  };
  const history = [
    {
      id: 1,
      paycheck_occurrence_id: 1,
      amount: "100.00",
      saved_on: "2026-01-03",
      note: null,
    },
  ];
  assert.deepEqual(savingsPaydays([payday], [payday], history), []);
  assert.deepEqual(savingsPaydays([payday], [payday], []), [payday]);
});
