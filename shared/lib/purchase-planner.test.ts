import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPurchasePlanInput,
  normalizePurchasePlannerCushion,
  purchasePlanSignature,
  purchaseVerdictContent,
  shouldShowPurchaseSavingPath,
  validatePurchasePlanDraft,
} from "@features/purchase-planner/model";
import { addDaysToIsoDate, todayInAppTimezone } from "@shared/lib/timezone";

describe("purchase planner", () => {
  it("validates the required planning fields", () => {
    assert.deepEqual(
      validatePurchasePlanDraft({
        name: "",
        amount: "",
        targetDate: "not-a-date",
        minimumCushion: "-1",
      }),
      {
        name: "Name what you are planning for.",
        amount: "Enter an amount greater than zero.",
        targetDate: "Choose a valid purchase date.",
        minimumCushion: "Enter a valid cushion or use zero.",
      },
    );
  });

  it("normalizes a valid API payload", () => {
    const input = buildPurchasePlanInput(
      {
        name: "  Laptop  ",
        amount: "$1,200",
        targetDate: addDaysToIsoDate(todayInAppTimezone(), 30),
        minimumCushion: "$250",
      },
      4,
    );

    assert.deepEqual(input, {
      name: "Laptop",
      amount: "1200.00",
      target_date: addDaysToIsoDate(todayInAppTimezone(), 30),
      minimum_cushion: "250.00",
      expected_planning_revision: 4,
    });
    assert.equal(
      purchasePlanSignature(input),
      JSON.stringify([
        "Laptop",
        "1200.00",
        addDaysToIsoDate(todayInAppTimezone(), 30),
        "250.00",
        4,
      ]),
    );
  });

  it("rejects invalid calendar dates, negative values, and server-limit overflows", () => {
    assert.deepEqual(
      validatePurchasePlanDraft({
        name: "Laptop",
        amount: "-100",
        targetDate: "2026-02-31",
        minimumCushion: "100000000",
      }),
      {
        amount: "Enter an amount greater than zero.",
        targetDate: "Choose a valid purchase date.",
        minimumCushion: "Enter a valid cushion or use zero.",
      },
    );
  });

  it("normalizes only safe stored cushion values", () => {
    assert.equal(normalizePurchasePlannerCushion("$250"), "250.00");
    assert.equal(normalizePurchasePlannerCushion("-10"), null);
    assert.equal(normalizePurchasePlannerCushion("100000000"), null);
  });

  it("maps server verdicts to stable user-facing copy", () => {
    assert.equal(
      purchaseVerdictContent({ verdict: "save_across_paychecks" }).title,
      "Set it aside over a few paychecks",
    );
  });

  it("shows paycheck-by-paycheck details only for savings recommendations", () => {
    assert.equal(
      shouldShowPurchaseSavingPath({ verdict: "save_across_paychecks" }),
      true,
    );
    assert.equal(
      shouldShowPurchaseSavingPath({ verdict: "choose_later_date" }),
      true,
    );
    assert.equal(
      shouldShowPurchaseSavingPath({ verdict: "fits_comfortably" }),
      false,
    );
  });
});
