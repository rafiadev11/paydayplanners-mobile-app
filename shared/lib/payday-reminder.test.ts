import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPaydayReminders,
  defaultPaydayPreferences,
  parsePaydayPreferences,
} from "../../features/notifications/payday-schedule";
import { notificationRoute } from "../../features/notifications/notification-route";
import { setAppTimezone } from "./timezone";

test("groups multiple income sources into one reminder and skips past or cancelled paydays", () => {
  setAppTimezone("America/New_York");
  const groups = buildPaydayReminders(
    [
      { occurrence_date: "2026-11-17", status: "projected" },
      { occurrence_date: "2026-11-17", status: "projected" },
      { occurrence_date: "2026-11-18", status: "skipped" },
      { occurrence_date: "2026-11-15", status: "projected" },
    ],
    defaultPaydayPreferences,
    new Date("2026-11-16T14:00:00Z"),
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0].date.toISOString(), "2026-11-17T14:00:00.000Z");
});
test("day-before timing crosses month boundaries and follows daylight savings", () => {
  setAppTimezone("America/New_York");
  const groups = buildPaydayReminders(
    [{ occurrence_date: "2026-11-02", status: "projected" }],
    { ...defaultPaydayPreferences, dayBefore: true },
    new Date("2026-10-30T00:00:00Z"),
  );
  assert.equal(groups[0].date.toISOString(), "2026-11-01T14:00:00.000Z");
  const month = buildPaydayReminders(
    [{ occurrence_date: "2026-12-01", status: "projected" }],
    { ...defaultPaydayPreferences, dayBefore: true },
    new Date("2026-11-29T00:00:00Z"),
  );
  assert.equal(month[0]?.date.toISOString(), "2026-11-30T14:00:00.000Z");
});
test("reserves at most twenty notification slots and validates stored settings", () => {
  setAppTimezone("UTC");
  assert.equal(
    buildPaydayReminders(
      Array.from({ length: 28 }, (_, i) => ({
        occurrence_date: `2026-12-${String(i + 1).padStart(2, "0")}`,
        status: "projected",
      })),
      defaultPaydayPreferences,
      new Date("2026-11-01"),
    ).length,
    20,
  );
  assert.deepEqual(parsePaydayPreferences("{broken"), defaultPaydayPreferences);
  assert.equal(parsePaydayPreferences('{"hour":99}').hour, 9);
});
test("notification routes are owned by the signed in account and cannot supply arbitrary URLs", () => {
  assert.equal(
    notificationRoute(
      { type: "payday-reminder", userId: "A", payday: "2026-11-17" },
      "B",
    ),
    null,
  );
  assert.deepEqual(
    notificationRoute(
      {
        type: "payday-reminder",
        userId: "A",
        payday: "2026-11-17",
        screen: "https://bad.test",
      },
      "A",
    ),
    { pathname: "/calendar", params: { date: "2026-11-17" } },
  );
});
