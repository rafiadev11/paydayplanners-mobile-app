package com.paydayplanners.watch

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class WatchSummaryTest {
    private fun raw() = javaClass.classLoader!!.getResource("summary-v1.json")!!.readText()
    @Test fun readsSharedFinancialContract() {
        val summary = WatchSummary.decode(raw())
        assertEquals(210000L, summary.nextPayday!!.amountMinor)
        assertEquals(24500L, summary.dueBeforePaydayMinor)
        assertEquals(4000L, summary.warning!!.unfundedMinor)
    }
    @Test fun usesAccountTimezoneAcrossMidnightAndDaylightSaving() {
        val summary = WatchSummary.decode(raw())
        assertEquals(3L, summary.daysUntil("2026-10-30", Instant.parse("2026-10-28T02:00:00Z")))
        assertEquals(1L, summary.daysUntil("2026-11-02", Instant.parse("2026-11-01T04:30:00Z")))
        assertFalse(summary.isStale(Instant.parse("2026-10-28T03:59:59Z")))
        assertTrue(summary.isStale(Instant.parse("2026-10-28T04:00:00Z")))
    }
    @Test fun rejectsOlderUpdates() {
        val summary = WatchSummary.decode(raw())
        val older = WatchSummary.decode(raw().replace("\"planning_revision\": 12", "\"planning_revision\": 11"))
        assertFalse(older.supersedes(summary))
        assertTrue(summary.supersedes(older))
    }
    @Test(expected = IllegalArgumentException::class) fun rejectsUnsupportedSchema() {
        WatchSummary.decode(raw().replace("\"schema_version\": 1", "\"schema_version\": 2"))
    }
    @Test fun cachedDueLabelsAdvanceAcrossMidnight() {
        val summary = WatchSummary.decode(raw())
        val now = Instant.parse("2026-10-29T14:00:00Z")
        assertEquals("1 day overdue", summary.dueLabel(summary.bills[0], now))
        assertEquals("Due today", summary.dueLabel(summary.bills[1], now))
        assertEquals("Tomorrow", summary.dateLabel("2026-10-30", now))
    }
    @Test fun refreshCooldownAllowsRecoveryAfterThirtySeconds() {
        val summary = WatchSummary.decode(raw())
        val now = Instant.now()
        assertTrue(summary.needsRefresh(null, now))
        assertFalse(summary.needsRefresh(now.minusSeconds(29), now))
        assertTrue(summary.needsRefresh(now.minusSeconds(30), now))
    }
    @Test(expected = java.time.format.DateTimeParseException::class) fun rejectsInvalidBillDates() {
        WatchSummary.decode(raw().replace("2026-10-28", "2026-02-30"))
    }
    @Test fun remindersGroupBillsAndDoNotReplayPastDates() {
        val summary = WatchSummary.decode(raw().replace("2026-10-29", "2026-10-28"))
        val now = Instant.parse("2026-10-27T14:00:00Z")
        val plan = BillReminderPlan.make(summary, now)
        assertEquals(1, plan.size)
        assertEquals(listOf("1", "2"), plan[0].billIDs)
        assertEquals(Instant.parse("2026-10-28T13:00:00Z"), plan[0].date)
        assertEquals(plan, BillReminderPlan.make(summary, now))
        assertTrue(BillReminderPlan.make(summary, plan[0].date).isEmpty())
    }
    @Test fun reminderDatesRespectDSTHorizonAndRemovedBills() {
        val now = Instant.parse("2026-10-31T14:00:00Z")
        val original = WatchSummary.decode(raw())
        val summary = original.copy(generatedAt = now, bills = listOf(original.bills[0].copy(dueDate = "2026-11-01"), original.bills[1].copy(dueDate = "2026-11-10")))
        val plan = BillReminderPlan.make(summary, now)
        assertEquals(1, plan.size)
        assertEquals(Instant.parse("2026-11-01T14:00:00Z"), plan[0].date)
        assertTrue(BillReminderPlan.make(summary.copy(bills = emptyList()), now).isEmpty())
        assertTrue(BillReminderPlan.make(summary, now.plusSeconds(8 * 86400)).isEmpty())
    }
    @Test fun remindersAreIndependentOfTheDisplayLimit() {
        val json = org.json.JSONObject(raw())
        json.put("reminder_bills", json.getJSONArray("bills"))
        json.put("bills", org.json.JSONArray())
        val summary = WatchSummary.decode(json.toString())
        val now = Instant.parse("2026-10-27T14:00:00Z")
        assertEquals(2, BillReminderPlan.make(summary, now).size)
        assertTrue(BillReminderPlan.make(summary.copy(reminderBills = emptyList()), now).isEmpty())
    }
}
