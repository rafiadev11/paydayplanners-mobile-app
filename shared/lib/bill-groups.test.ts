import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBillGroups,
  changedBillGroups,
  billListScheduleLabel,
} from "@features/money/bill-groups";
import { monthlyEquivalent } from "@features/money/monthly";
import type { Bill } from "@features/planning/api";
const bill = (
  id: number,
  frequency: string,
  overrides: Partial<Bill> = {},
): Bill => ({
  id,
  name: `Bill ${id}`,
  amount: "120.00",
  frequency,
  start_date: "2026-10-15",
  is_active: true,
  is_subscription: false,
  ...overrides,
});
describe("monthly equivalents follow server interval semantics", () => {
  for (const [frequency, interval, expected] of [
    ["weekly", 1, 5200 / 12],
    ["weekly", 2, 2600 / 12],
    ["biweekly", undefined, 2600 / 12],
    ["biweekly", 2, 2600 / 12],
    ["biweekly", 1, 2600 / 12],
    ["biweekly", 4, 1300 / 12],
    ["semimonthly", 31, 200],
    ["semimonthly", 15, 200],
    ["monthly", 3, 100],
    ["yearly", 2, 100 / 12],
    ["once", 1, 0],
    ["unknown", 1, 0],
  ] as const)
    it(`${frequency} with interval ${interval}`, () =>
      assert.ok(
        Math.abs(monthlyEquivalent(100, frequency, interval) - expected) < 1e-9,
      ));
});
describe("bill sections", () => {
  it("places every bill exactly once, with planned purchases taking precedence", () => {
    const input = [
      bill(1, "monthly"),
      bill(2, "yearly"),
      bill(3, "weekly"),
      bill(4, "once"),
      bill(5, "new_frequency"),
      bill(6, "once", { kind: "planned_expense" }),
    ];
    const groups = buildBillGroups(input, "amount");
    assert.deepEqual(
      groups.map((g) => g.key),
      ["monthly", "yearly", "other", "once", "unknown", "planned"],
    );
    assert.deepEqual(
      groups.flatMap((g) => g.rows.map((b) => b.id)),
      [1, 2, 3, 4, 5, 6],
    );
  });
  it("keeps paused bills last and excludes them from totals", () => {
    const group = buildBillGroups(
      [
        bill(1, "yearly", { amount: "500", is_active: false }),
        bill(2, "yearly"),
      ],
      "amount",
    )[0];
    assert.deepEqual(
      group.rows.map((b) => b.id),
      [2, 1],
    );
    assert.equal(group.total, 120);
    assert.equal(group.monthly, 10);
    assert.equal(group.activeCount, 1);
    assert.equal(group.pausedCount, 1);
  });
  it("retains paused-only sections and hides empty sections", () => {
    assert.deepEqual(buildBillGroups([], "name"), []);
    const groups = buildBillGroups(
      [bill(1, "monthly", { is_active: false })],
      "name",
    );
    assert.equal(groups.length, 1);
    assert.equal(groups[0].total, 0);
  });
  it("sorts annual dates in calendar order including leap day without timezone conversion", () => {
    const rows = buildBillGroups(
      [
        bill(1, "yearly"),
        bill(2, "yearly", { start_date: "2028-02-29" }),
        bill(3, "yearly", { start_date: "2027-01-01" }),
      ],
      "schedule",
    )[0].rows;
    assert.deepEqual(
      rows.map((b) => b.id),
      [3, 2, 1],
    );
  });
  it("uses monthly due day rather than start date", () => {
    const rows = buildBillGroups(
      [bill(1, "monthly", { due_day: 31 }), bill(2, "monthly", { due_day: 6 })],
      "schedule",
    )[0].rows;
    assert.deepEqual(
      rows.map((b) => b.id),
      [2, 1],
    );
  });
  it("does not mutate cached data and breaks ties deterministically", () => {
    const input = [
      bill(2, "monthly", { name: "Same" }),
      bill(1, "monthly", { name: "Same" }),
    ];
    const snapshot = structuredClone(input);
    assert.deepEqual(
      buildBillGroups(input, "amount")[0].rows.map((b) => b.id),
      [1, 2],
    );
    assert.deepEqual(input, snapshot);
  });
  it("preserves cents before calculating equivalents", () => {
    const group = buildBillGroups(
      [
        bill(1, "yearly", { amount: "9.99" }),
        bill(2, "yearly", { amount: "9.99" }),
      ],
      "amount",
    )[0];
    assert.equal(group.total, 19.98);
    assert.ok(Math.abs(group.monthly - 1.665) < 1e-9);
  });
  it("reopens only destinations for additions and frequency changes", () => {
    const original = [bill(1, "monthly"), bill(2, "yearly")];
    assert.deepEqual(
      [...changedBillGroups(original, structuredClone(original))],
      [],
    );
    assert.deepEqual(
      [...changedBillGroups(original, [bill(1, "yearly"), bill(2, "yearly")])],
      ["yearly"],
    );
    assert.deepEqual(
      [...changedBillGroups(original, [...original, bill(3, "monthly")])],
      ["monthly"],
    );
    assert.deepEqual(
      [...changedBillGroups(original, [bill(1, "monthly")])],
      [],
    );
  });
  it("keeps planned purchases chronological regardless of the sort", () => {
    const group = buildBillGroups(
      [
        bill(1, "once", {
          kind: "planned_expense",
          start_date: "2026-12-01",
          amount: "999",
        }),
        bill(2, "once", { kind: "planned_expense", start_date: "2026-01-01" }),
      ],
      "amount",
    )[0];
    assert.deepEqual(
      group.rows.map((b) => b.id),
      [2, 1],
    );
  });
});

describe("defensive schedule display", () => {
  it("does not treat inherited object properties as frequency multipliers", () => {
    for (const frequency of ["constructor", "toString", "__proto__"]) {
      assert.equal(monthlyEquivalent(100, frequency), 0);
      const group = buildBillGroups([bill(1, frequency)], "amount")[0];
      assert.equal(group.key, "unknown");
      assert.equal(group.monthly, 0);
    }
  });
});

it("describes month-end, legacy intervals and annual anniversaries correctly", () => {
  assert.equal(
    billListScheduleLabel(bill(1, "monthly", { due_day: 31 })),
    "Monthly · last day of the month",
  );
  assert.equal(
    billListScheduleLabel(
      bill(1, "monthly", { due_day: 6, interval_value: 3 }),
    ),
    "monthly, 6th",
  );
  assert.equal(
    billListScheduleLabel(bill(1, "yearly", { start_date: "2028-02-29" })),
    "Yearly · scheduled Feb 29",
  );
  assert.equal(
    billListScheduleLabel(bill(1, "biweekly", { interval_value: 4 })),
    "Every 4 weeks",
  );
  assert.equal(billListScheduleLabel(bill(1, "semimonthly")), "Twice a month");
});
