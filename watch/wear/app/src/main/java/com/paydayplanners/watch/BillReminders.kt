package com.paydayplanners.watch

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.util.concurrent.Executors

class BillReminders(private val context: Context) {
    private val prefs = context.getSharedPreferences("watch-reminders", Context.MODE_PRIVATE)
    private val alarms = context.getSystemService(AlarmManager::class.java)
    private val notifications = context.getSystemService(NotificationManager::class.java)
    val enabled get() = prefs.getBoolean("enabled", false)
    val allowed get() = notifications.areNotificationsEnabled() && notifications.getNotificationChannel(CHANNEL)?.importance != NotificationManager.IMPORTANCE_NONE

    init {
        notifications.createNotificationChannel(NotificationChannel(CHANNEL, "Bill reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = "Due-day reminders from your saved Payday plan"
            lockscreenVisibility = Notification.VISIBILITY_PRIVATE
        })
    }

    private fun alarm(id: String): PendingIntent = PendingIntent.getBroadcast(
        context, 0, Intent(context, BillReminderReceiver::class.java).setAction(ACTION).setData(Uri.parse("payday-watch://reminder/$id")),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    fun disable() {
        synchronized(LOCK) {
            prefs.edit().putBoolean("enabled", false).apply()
            cancel()
            prefs.edit().remove("delivered").apply()
            notifications.cancelAll()
        }
    }

    fun enable(summary: WatchSummary): String {
        synchronized(LOCK) {
            if (!allowed) return "Allow notifications in watch settings first."
            if (summary.isStale()) return "Refresh your plan before enabling reminders."
            prefs.edit().putBoolean("enabled", true).apply()
            return sync(summary)
        }
    }

    private fun cancel() {
        prefs.getStringSet("scheduled", emptySet())!!.forEach { alarms.cancel(alarm(it)) }
        alarms.cancel(alarm("test"))
        prefs.edit().remove("scheduled").apply()
    }

    fun sync(summary: WatchSummary): String {
        synchronized(LOCK) {
            if (!enabled) return "Watch reminders are off."
            val validBills = summary.reminderSource.groupBy { "bill-due-${it.dueDate}" }.mapValues { (_, bills) -> bills.map { it.id }.toSet() }
            notifications.activeNotifications.filter {
                it.tag?.startsWith("bill-due-") == true &&
                    (it.tag !in validBills || it.notification.extras.getStringArrayList("billIDs")?.toSet() != validBills[it.tag])
            }
                .forEach { notifications.cancel(it.tag, it.id) }
            if (!allowed) { cancel(); return "Notifications are blocked in watch settings." }
            val plan = BillReminderPlan.make(summary)
            val now = Instant.now()
            val today = now.atZone(summary.timezone).toLocalDate().toString()
            val previous = prefs.getStringSet("scheduled", emptySet())!!.toSet()
            // An inexact alarm may still be waiting after 9 a.m. Preserve it while
            // its bills remain due today, rather than cancelling it on refresh.
            val awaitingDelivery = previous.filter { id ->
                id == "bill-due-$today" && !prefs.getStringSet("delivered", emptySet())!!.contains(id) && summary.reminderSource.any { it.dueDate == today } &&
                    !now.isAfter(summary.generatedAt.atZone(summary.timezone).plusDays(7).toInstant())
            }.toSet()
            val scheduled = plan.map { it.id }.toSet() + awaitingDelivery
            (previous - scheduled).forEach { alarms.cancel(alarm(it)) }
            plan.forEach { alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, it.date.toEpochMilli(), alarm(it.id)) }
            prefs.edit().putStringSet("scheduled", scheduled).apply()
            val oldest = Instant.now().atZone(summary.timezone).toLocalDate().minusDays(7).toString()
            prefs.edit().putStringSet("delivered", prefs.getStringSet("delivered", emptySet())!!.filter { it.removePrefix("bill-due-") >= oldest }.toSet()).apply()
            return if (scheduled.isEmpty()) "No reminder dates in the next 7 days." else "${scheduled.size} reminder ${if (scheduled.size == 1) "date" else "dates"} scheduled."
        }
    }

    fun test(): String {
        synchronized(LOCK) {
            if (!enabled || !allowed) return "Enable reminders and allow notifications first."
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 5000, alarm("test"))
            return "Test scheduled shortly. Wear OS may delay delivery."
        }
    }

    fun restore() {
        synchronized(LOCK) {
            if (!enabled) return
            if (SessionStorage(context).read() == null) { disable(); return }
            val summary = runCatching { WatchSummary.decode(File(context.noBackupFilesDir, "watch-summary.json").readText()) }.getOrNull()
            cancel()
            if (summary != null) sync(summary)
        }
    }

    fun deliver(id: String) {
        synchronized(LOCK) {
            if (!enabled || !allowed) return
            if (SessionStorage(context).read() == null) { disable(); return }
            if (id == "test") { notify(id, "Payday reminder test", "Your watch is ready for bill reminders."); return }
            val summary = runCatching { WatchSummary.decode(File(context.noBackupFilesDir, "watch-summary.json").readText()) }.getOrNull() ?: return
            val dueDate = runCatching { LocalDate.parse(id.removePrefix("bill-due-")) }.getOrNull() ?: return
            val today = Instant.now().atZone(summary.timezone).toLocalDate()
            if (today != dueDate || Instant.now().isAfter(summary.generatedAt.atZone(summary.timezone).plusDays(7).toInstant())) return
            val bills = summary.reminderSource.filter { it.dueDate == dueDate.toString() }.distinctBy { it.id }
            if (bills.isEmpty()) return
            val delivered = prefs.getStringSet("delivered", emptySet())!!.toMutableSet()
            if (!delivered.add(id)) return
            notify(id, if (bills.size == 1) "Bill due today" else "Bills due today", "${bills.size} ${if (bills.size == 1) "bill is" else "bills are"} due in your saved plan. Open Payday to review.", bills.map { it.id })
            prefs.edit().putStringSet("delivered", delivered).apply()
        }
    }

    private fun notify(id: String, title: String, body: String, billIDs: List<String> = emptyList()) {
        val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java).setAction("com.paydayplanners.watch.OPEN_BILLS").addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = Notification.Builder(context, CHANNEL).setSmallIcon(R.drawable.ic_bill_reminder)
            .setContentTitle(title).setContentText(body).setStyle(Notification.BigTextStyle().bigText(body))
            .addExtras(android.os.Bundle().apply { putStringArrayList("billIDs", ArrayList(billIDs)) })
            .setContentIntent(open).setAutoCancel(true).setLocalOnly(true).setVisibility(Notification.VISIBILITY_PRIVATE).build()
        notifications.notify(id, 0, notification)
    }

    companion object {
        private val LOCK = Any()
        const val CHANNEL = "watch-bill-reminders"
        const val ACTION = "com.paydayplanners.watch.BILL_REMINDER"
    }
}

class BillReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync()
        EXECUTOR.execute {
            try {
                val reminders = BillReminders(context.applicationContext)
                if (intent.action == BillReminders.ACTION) intent.data?.lastPathSegment?.let { reminders.deliver(it) }
                else reminders.restore()
            } catch (error: Exception) {
                android.util.Log.e("BillReminders", "Reminder delivery or restoration failed", error)
            } finally { pending.finish() }
        }
    }
    companion object { private val EXECUTOR = Executors.newSingleThreadExecutor() }
}
