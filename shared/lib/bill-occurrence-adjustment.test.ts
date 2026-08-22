import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  billOccurrenceAdjustmentSignature,
  billOccurrenceDraftHasChanges,
  billOccurrenceDraftIsAdjusted,
  validateBillOccurrenceAdjustment,
} from "@features/planning/bill-occurrence-adjustment";

describe("bill occurrence adjustment", () => {
  it("validates amount and date fields", () => {
    assert.deepEqual(
      validateBillOccurrenceAdjustment({
        amount: "",
        dueDate: "April 10",
        status: "projected",
      }),
      {
        amount: "Enter a valid payment amount.",
        dueDate: "Choose a valid due date.",
      },
    );

    assert.deepEqual(
      validateBillOccurrenceAdjustment({
        amount: "125.50",
        dueDate: "2026-04-10",
        status: "paid",
      }),
      {},
    );
  });

  it("normalizes currency in preview signatures", () => {
    assert.equal(
      billOccurrenceAdjustmentSignature(
        {
          amount: "$00125.5",
          dueDate: "2026-04-10",
          status: "projected",
        },
        4,
      ),
      "125.50|2026-04-10|projected|4",
    );
  });

  it("distinguishes scheduled values from a one-payment adjustment", () => {
    assert.equal(
      billOccurrenceDraftIsAdjusted(
        {
          amount: "100.00",
          dueDate: "2026-04-10",
          status: "projected",
        },
        "100.00",
        "2026-04-10",
      ),
      false,
    );
    assert.equal(
      billOccurrenceDraftIsAdjusted(
        {
          amount: "100.00",
          dueDate: "2026-04-12",
          status: "projected",
        },
        "100.00",
        "2026-04-10",
      ),
      true,
    );
  });

  it("detects whether the draft differs from the effective payment", () => {
    const draft = {
      amount: "125.00",
      dueDate: "2026-04-10",
      status: "projected" as const,
    };

    assert.equal(
      billOccurrenceDraftHasChanges(draft, "125.00", "2026-04-10", "projected"),
      false,
    );
    assert.equal(
      billOccurrenceDraftHasChanges(
        { ...draft, status: "paid" },
        "125.00",
        "2026-04-10",
        "projected",
      ),
      true,
    );
  });
});
