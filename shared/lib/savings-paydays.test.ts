import assert from "node:assert/strict";
import { it } from "node:test";
import {
  savingsPaydays,
  mergeContributionPage,
} from "@features/goals/savings-paydays";

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

it("merges overlapping history pages without losing entries or duplicating undo buttons", () => {
  const first = {
    id: 3,
    amount: "10.00",
    saved_on: "2026-04-03",
    paycheck_occurrence_id: null,
    note: null,
  };
  const overlapping = { ...first, id: 2, saved_on: "2026-04-02" };
  const last = { ...first, id: 1, saved_on: "2026-04-01" };
  const updated = { ...overlapping, amount: "20.00" };
  assert.deepEqual(
    mergeContributionPage([first, overlapping], [updated, last]),
    [first, updated, last],
  );
});
