package com.paydayplanners.watch

import org.json.JSONObject
import java.math.BigDecimal
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import java.util.Currency

data class WatchBill(val id: String, val name: String, val dueDate: String, val amountMinor: Long, val unfundedMinor: Long, val overdue: Boolean)
data class WatchPayday(val date: String, val amountMinor: Long)
data class WatchSummary(
    val revision: Long, val generatedAt: Instant, val validUntil: Instant,
    val timezone: ZoneId, val currency: String, val nextPayday: WatchPayday?,
    val dueBeforePaydayMinor: Long?, val dueOnPaydayMinor: Long?,
    val bills: List<WatchBill>, val warning: WatchBill?, val totalBillCount: Int, val reminderBills: List<WatchBill>? = null
) {
    val reminderSource get() = reminderBills ?: bills
    fun isStale(now: Instant = Instant.now()) = !now.isBefore(validUntil)
    fun daysUntil(date: String, now: Instant = Instant.now()): Long = ChronoUnit.DAYS.between(now.atZone(timezone).toLocalDate(), LocalDate.parse(date))
    fun dateLabel(date: String, now: Instant = Instant.now()): String = when (val days = daysUntil(date, now)) {
        0L -> "Today"
        1L -> "Tomorrow"
        -1L -> "Yesterday"
        else -> LocalDate.parse(date).format(DateTimeFormatter.ofPattern(if (kotlin.math.abs(days) < 7) "EEE" else "MMM d"))
    }
    fun dueLabel(bill: WatchBill, now: Instant = Instant.now()): String {
        val days = daysUntil(bill.dueDate, now)
        return if (days < 0) "${-days} ${if (days == -1L) "day" else "days"} overdue" else "Due ${dateLabel(bill.dueDate, now).lowercase()}"
    }
    fun needsRefresh(lastAttempt: Instant?, now: Instant = Instant.now()) = lastAttempt == null || java.time.Duration.between(lastAttempt, now).seconds >= 30
    fun supersedes(previous: WatchSummary) = revision > previous.revision || (revision == previous.revision && !generatedAt.isBefore(previous.generatedAt))
    fun money(minor: Long): String = NumberFormat.getCurrencyInstance().apply {
        currency = Currency.getInstance(this@WatchSummary.currency)
        maximumFractionDigits = if (minor % 100L == 0L) 0 else 2
    }.format(BigDecimal.valueOf(minor, 2))
    companion object {
        private fun bill(json: JSONObject) = WatchBill(json.getString("id"), json.getString("name"), LocalDate.parse(json.getString("due_date")).toString(), json.getLong("amount_minor"), json.getLong("unfunded_minor"), json.getBoolean("overdue"))
        fun decode(raw: String): WatchSummary {
            val json = JSONObject(raw)
            require(json.getInt("schema_version") == 1) { "Unsupported summary version" }
            val payday = json.optJSONObject("next_payday")
            val rows = json.getJSONArray("bills")
            return WatchSummary(
                json.getLong("planning_revision"), Instant.parse(json.getString("generated_at")), Instant.parse(json.getString("valid_until")),
                ZoneId.of(json.getString("timezone")), json.getString("currency"),
                payday?.let { WatchPayday(LocalDate.parse(it.getString("date")).toString(), it.getLong("amount_minor")) },
                if (json.isNull("due_before_payday_minor")) null else json.getLong("due_before_payday_minor"),
                if (json.isNull("due_on_payday_minor")) null else json.getLong("due_on_payday_minor"),
                (0 until rows.length()).map { bill(rows.getJSONObject(it)) }, json.optJSONObject("funding_warning")?.let { bill(it) }, json.getInt("total_bill_count"),
                json.optJSONArray("reminder_bills")?.let { reminders -> (0 until reminders.length()).map { bill(reminders.getJSONObject(it)) } }
            )
        }
    }
}
