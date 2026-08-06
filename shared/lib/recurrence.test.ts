import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { firstOccurrenceOf, nextOccurrences } from "@shared/lib/recurrence";

/**
 * `recurrence.ts` is a hand port of `web/app/Support/RecurringDateGenerator.php`.
 * Nothing at runtime keeps the two honest, so the table below is the contract:
 * every case was produced by running the same rule through the PHP generator
 * and recording what it returned.
 *
 * If a case here starts failing, the client and the server disagree about when
 * a bill is due — regenerate against the PHP and reconcile deliberately. Do not
 * simply update the expectation.
 *
 * To regenerate:
 *   php artisan tinker --execute '$g = app(App\Support\RecurringDateGenerator::class); ...'
 */
const PHP_PARITY_CASES: {
  name: string;
  rule: Parameters<typeof nextOccurrences>[0];
  expected: string[];
}[] = [
  {
    name: "monthly on the 31st clamps to each month's last day",
    rule: { frequency: "monthly", startDate: "2026-01-31" },
    expected: [
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
      "2026-06-30",
    ],
  },
  {
    name: "monthly on the 29th clamps only in February",
    rule: { frequency: "monthly", startDate: "2026-01-29" },
    expected: [
      "2026-01-29",
      "2026-02-28",
      "2026-03-29",
      "2026-04-29",
      "2026-05-29",
      "2026-06-29",
    ],
  },
  {
    name: "monthly stops at the end date",
    rule: {
      frequency: "monthly",
      startDate: "2026-11-30",
      endDate: "2027-01-15",
    },
    expected: ["2026-11-30", "2026-12-30"],
  },
  {
    name: "yearly on Feb 29 falls back to the 28th in common years",
    rule: { frequency: "yearly", startDate: "2028-02-29" },
    expected: [
      "2028-02-29",
      "2029-02-28",
      "2030-02-28",
      "2031-02-28",
      "2032-02-29",
      "2033-02-28",
    ],
  },
  {
    name: "weekly advances seven days",
    rule: { frequency: "weekly", startDate: "2026-03-05" },
    expected: [
      "2026-03-05",
      "2026-03-12",
      "2026-03-19",
      "2026-03-26",
      "2026-04-02",
      "2026-04-09",
    ],
  },
  {
    name: "biweekly holds its cadence across the spring DST change",
    rule: { frequency: "biweekly", startDate: "2026-03-01" },
    expected: [
      "2026-03-01",
      "2026-03-15",
      "2026-03-29",
      "2026-04-12",
      "2026-04-26",
      "2026-05-10",
    ],
  },
  {
    name: "biweekly holds its cadence across the autumn DST change",
    rule: { frequency: "biweekly", startDate: "2026-10-25" },
    expected: [
      "2026-10-25",
      "2026-11-08",
      "2026-11-22",
      "2026-12-06",
      "2026-12-20",
      "2027-01-03",
    ],
  },
  {
    name: "semimonthly with a second day of 31 uses each month's last day",
    rule: {
      frequency: "semimonthly",
      startDate: "2026-08-15",
      secondMonthDay: 31,
    },
    expected: [
      "2026-08-15",
      "2026-08-31",
      "2026-09-15",
      "2026-09-30",
      "2026-10-15",
      "2026-10-31",
    ],
  },
  {
    name: "semimonthly orders its two days regardless of which was entered first",
    rule: {
      frequency: "semimonthly",
      startDate: "2026-01-31",
      secondMonthDay: 15,
    },
    expected: [
      "2026-01-31",
      "2026-02-15",
      "2026-02-28",
      "2026-03-15",
      "2026-03-31",
      "2026-04-15",
    ],
  },
  {
    name: "a one-time date past its end date yields nothing",
    rule: {
      frequency: "once",
      startDate: "2026-08-15",
      endDate: "2026-08-01",
    },
    expected: [],
  },
];

describe("nextOccurrences matches RecurringDateGenerator", () => {
  for (const { name, rule, expected } of PHP_PARITY_CASES) {
    it(name, () => {
      assert.deepEqual(nextOccurrences(rule, expected.length || 3), expected);
    });
  }
});

describe("stored day rules win over the start date", () => {
  // Every seeded bill starts Jan 1 but is due on its own day; reading one back
  // must honour `due_day`, or editing it would rewrite the schedule on save.
  it("uses monthDay when it differs from the start date's day", () => {
    assert.equal(
      firstOccurrenceOf({
        frequency: "monthly",
        startDate: "2026-01-01",
        monthDay: 6,
      }),
      "2026-01-06",
    );
  });

  it("round-trips, so the seeded date re-derives the same day", () => {
    for (const monthDay of [6, 10, 12, 14, 15, 18]) {
      const seeded = firstOccurrenceOf({
        frequency: "monthly",
        startDate: "2026-01-01",
        monthDay,
      });

      assert.equal(Number(seeded!.slice(8, 10)), monthDay);
    }
  });

  it("advances to the stored weekday", () => {
    // 2026-01-01 is a Thursday; weekday 1 is Monday.
    assert.equal(
      firstOccurrenceOf({
        frequency: "weekly",
        startDate: "2026-01-01",
        weekday: 1,
      }),
      "2026-01-05",
    );
  });

  it("leaves the start date alone when the weekday already matches", () => {
    assert.equal(
      firstOccurrenceOf({
        frequency: "weekly",
        startDate: "2026-01-01",
        weekday: 4,
      }),
      "2026-01-01",
    );
  });
});

describe("notBefore skips dates already gone", () => {
  const TODAY = "2026-08-05";

  it("returns the upcoming occurrences of an old series", () => {
    assert.deepEqual(
      nextOccurrences(
        {
          frequency: "monthly",
          startDate: "2026-01-10",
          monthDay: 10,
          notBefore: TODAY,
        },
        3,
      ),
      ["2026-08-10", "2026-09-10", "2026-10-10"],
    );
  });

  it("does not affect seeding, which wants the true first occurrence", () => {
    assert.equal(
      firstOccurrenceOf({
        frequency: "monthly",
        startDate: "2026-01-01",
        monthDay: 6,
      }),
      "2026-01-06",
    );
  });

  it("rolls a yearly rule whose anniversary already passed", () => {
    assert.deepEqual(
      nextOccurrences(
        { frequency: "yearly", startDate: "2026-03-01", notBefore: TODAY },
        2,
      ),
      ["2027-03-01", "2028-03-01"],
    );
  });

  it("yields nothing for a one-time date in the past", () => {
    assert.deepEqual(
      nextOccurrences(
        { frequency: "once", startDate: "2026-01-01", notBefore: TODAY },
        3,
      ),
      [],
    );
  });

  it("yields nothing for a series that already ended", () => {
    assert.deepEqual(
      nextOccurrences(
        {
          frequency: "monthly",
          startDate: "2026-01-10",
          monthDay: 10,
          endDate: "2026-03-10",
          notBefore: TODAY,
        },
        3,
      ),
      [],
    );
  });

  it("resolves a decade-old weekly series without hanging", () => {
    assert.equal(
      nextOccurrences(
        { frequency: "weekly", startDate: "2016-01-01", notBefore: TODAY },
        1,
      ).length,
      1,
    );
  });
});

describe("incomplete rules", () => {
  it("returns nothing for an unparseable start date", () => {
    assert.deepEqual(
      nextOccurrences({ frequency: "monthly", startDate: "" }),
      [],
    );
  });

  it("returns nothing when asked for zero dates", () => {
    assert.deepEqual(
      nextOccurrences({ frequency: "monthly", startDate: "2026-08-15" }, 0),
      [],
    );
  });
});
