import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildOnboardingPayload,
  emptyOnboardingDraft,
  paycheckDraftErrors,
  STARTER_BILL_TEMPLATES,
  starterBillDraftErrors,
  starterBillFromTemplate,
} from "@features/onboarding/model";
import {
  authenticatedEntryRoute,
  shouldEnterGuidedOnboarding,
} from "@features/onboarding/routing";
import { todayInAppTimezone } from "@shared/lib/timezone";

describe("guided onboarding routing", () => {
  it("routes only enabled pending users into onboarding", () => {
    const pendingUser = {
      id: 1,
      name: "Alex",
      email: "alex@example.com",
      onboarding: {
        enabled: true,
        version: 0,
        status: "pending" as const,
      },
    };

    assert.equal(shouldEnterGuidedOnboarding(pendingUser), true);
    assert.equal(authenticatedEntryRoute(pendingUser), "/onboarding");
    assert.equal(
      shouldEnterGuidedOnboarding({
        ...pendingUser,
        onboarding: { ...pendingUser.onboarding, enabled: false },
      }),
      false,
    );
    assert.equal(
      shouldEnterGuidedOnboarding({
        ...pendingUser,
        onboarding: {
          ...pendingUser.onboarding,
          version: 1,
          status: "completed",
        },
      }),
      false,
    );
  });

  it("keeps users from older API responses on the existing dashboard", () => {
    const legacyResponseUser = {
      id: 1,
      name: "Alex",
      email: "alex@example.com",
    };

    assert.equal(shouldEnterGuidedOnboarding(legacyResponseUser), false);
    assert.equal(authenticatedEntryRoute(legacyResponseUser), "/dashboard");
  });
});

describe("onboarding payload", () => {
  it("derives recurrence fields from the dates users choose", () => {
    const draft = emptyOnboardingDraft();
    draft.paycheck.amount = "$2,400.00";
    draft.paycheck.startDate = "2026-08-28";
    const rent = starterBillFromTemplate(STARTER_BILL_TEMPLATES[0], "rent");
    rent.name = "Rent";
    rent.amount = "1,200";
    rent.startDate = "2026-09-01";
    draft.bills = [rent];

    assert.deepEqual(buildOnboardingPayload(draft), {
      version: 1,
      pay_schedule: {
        name: "Main paycheck",
        amount: "2400.00",
        frequency: "biweekly",
        start_date: "2026-08-28",
        is_active: true,
        weekday: 5,
        interval_value: 2,
      },
      bills: [
        {
          name: "Rent",
          amount: "1200.00",
          frequency: "monthly",
          start_date: "2026-09-01",
          is_active: true,
          due_day: 1,
        },
      ],
    });
  });

  it("builds semimonthly schedules with two different month days", () => {
    const draft = emptyOnboardingDraft();
    draft.paycheck.amount = "1800";
    draft.paycheck.frequency = "semimonthly";
    draft.paycheck.startDate = "2026-08-15";
    draft.paycheck.secondMonthDay = 31;

    assert.deepEqual(buildOnboardingPayload(draft).pay_schedule, {
      name: "Main paycheck",
      amount: "1800.00",
      frequency: "semimonthly",
      start_date: "2026-08-15",
      is_active: true,
      month_day: 15,
      interval_value: 31,
    });
  });

  it("supports a first-and-fifteenth semimonthly schedule", () => {
    const draft = emptyOnboardingDraft();
    draft.paycheck.amount = "1800";
    draft.paycheck.frequency = "semimonthly";
    draft.paycheck.startDate = "2026-08-15";
    draft.paycheck.secondMonthDay = 1;

    assert.equal(buildOnboardingPayload(draft).pay_schedule.month_day, 15);
    assert.equal(buildOnboardingPayload(draft).pay_schedule.interval_value, 1);
  });
});

describe("onboarding validation", () => {
  it("requires the essential paycheck fields", () => {
    assert.deepEqual(paycheckDraftErrors(emptyOnboardingDraft().paycheck), {
      amount: "Enter the amount that normally reaches you.",
      startDate: "Choose your next pay date.",
    });
  });

  it("rejects an incomplete starter bill", () => {
    const bill = starterBillFromTemplate(STARTER_BILL_TEMPLATES[3], "phone");

    assert.deepEqual(starterBillDraftErrors(bill), {
      amount: "Enter the amount you expect.",
      startDate: "Choose the next due date.",
    });
  });

  it("rejects values that exceed the API database precision", () => {
    const draft = emptyOnboardingDraft();
    draft.paycheck.amount = "100000000";
    const bill = starterBillFromTemplate(STARTER_BILL_TEMPLATES[3], "phone");
    bill.amount = "100000000";

    assert.equal(
      paycheckDraftErrors(draft.paycheck).amount,
      "Enter an amount below $100 million.",
    );
    assert.equal(
      starterBillDraftErrors(bill).amount,
      "Enter an amount below $100 million.",
    );
  });

  it("rejects dates before today", () => {
    const draft = emptyOnboardingDraft();
    draft.paycheck.amount = "2400";
    draft.paycheck.startDate = "2000-01-01";
    const bill = starterBillFromTemplate(STARTER_BILL_TEMPLATES[0], "housing");
    bill.amount = "1200";
    bill.startDate = "2000-01-01";

    assert.notEqual(todayInAppTimezone(), "2000-01-01");
    assert.equal(
      paycheckDraftErrors(draft.paycheck).startDate,
      "Choose today or a future pay date.",
    );
    assert.equal(
      starterBillDraftErrors(bill).startDate,
      "Choose today or a future due date.",
    );
  });
});
