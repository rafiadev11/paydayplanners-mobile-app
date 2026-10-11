import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { monthGridWeeks } from "@shared/lib/month";

describe("Sunday-first calendar weeks", () => {
  it("puts October 10, 2026 in the second week's Saturday column", () => {
    const weeks = monthGridWeeks("2026-10");
    assert.equal(weeks[1][6].date, "2026-10-10");
    assert.deepEqual(
      weeks[0].map((cell) => cell.date),
      [
        "2026-09-27",
        "2026-09-28",
        "2026-09-29",
        "2026-09-30",
        "2026-10-01",
        "2026-10-02",
        "2026-10-03",
      ],
    );
  });

  it("keeps every weekday in its column for all starting offsets and leap years", () => {
    const startingOffsets = new Set<number>();
    for (const year of [2026, 2028]) {
      for (let month = 1; month <= 12; month++) {
        const monthKey = `${year}-${String(month).padStart(2, "0")}`;
        const weeks = monthGridWeeks(monthKey);
        assert.equal(weeks.length, 6);
        const cells = weeks.flat();
        assert.equal(new Set(cells.map((cell) => cell.date)).size, 42);
        startingOffsets.add(
          cells.findIndex((cell) => cell.date === `${monthKey}-01`),
        );
        weeks.forEach((week) => {
          assert.equal(week.length, 7);
          week.forEach((cell, column) => {
            assert.equal(
              new Date(`${cell.date}T12:00:00Z`).getUTCDay(),
              column,
            );
            assert.equal(cell.inMonth, cell.date.startsWith(`${monthKey}-`));
          });
        });
        for (let index = 1; index < cells.length; index++) {
          assert.equal(
            Date.parse(`${cells[index].date}T12:00:00Z`) -
              Date.parse(`${cells[index - 1].date}T12:00:00Z`),
            86_400_000,
          );
        }
      }
    }
    assert.equal(startingOffsets.size, 7);
    assert.ok(
      monthGridWeeks("2028-02")
        .flat()
        .some((cell) => cell.date === "2028-02-29" && cell.inMonth),
    );
    assert.equal(monthGridWeeks("2026-12")[5][6].date, "2027-01-09");
  });
});
