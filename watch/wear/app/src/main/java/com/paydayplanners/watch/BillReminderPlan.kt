package com.paydayplanners.watch

import java.time.Instant
import java.time.LocalDate

data class BillReminderPlan(val id: String, val date: Instant, val billIDs: List<String>) {
    companion object {
        fun make(summary: WatchSummary, now: Instant = Instant.now()): List<BillReminderPlan> {
            val horizon = summary.generatedAt.atZone(summary.timezone).plusDays(7).toInstant()
            return summary.reminderSource.groupBy { it.dueDate }.mapNotNull { (day, bills) ->
                val date = LocalDate.parse(day).atTime(9, 0).atZone(summary.timezone).toInstant()
                if (!date.isAfter(now) || date.isAfter(horizon)) null
                else BillReminderPlan("bill-due-$day", date, bills.map { it.id }.distinct().sorted())
            }.sortedBy { it.date }
        }
    }
}
