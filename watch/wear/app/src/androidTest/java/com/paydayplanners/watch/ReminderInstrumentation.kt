package com.paydayplanners.watch

import android.app.Instrumentation
import android.app.Activity
import android.app.NotificationManager
import android.os.Bundle
import java.io.File

/** Runs against a signed-in emulator with notification permission granted. */
class ReminderInstrumentation : Instrumentation() {
    private var preview = false
    override fun onCreate(arguments: Bundle?) { super.onCreate(arguments); preview = arguments?.getString("preview") == "true"; start() }
    override fun onStart() {
        val context = targetContext
        val reminders = BillReminders(context)
        val wasEnabled = reminders.enabled
        if (preview) {
            val prefs = context.getSharedPreferences("watch-reminders", 0)
            try {
                check(reminders.allowed) { "Allow notifications before previewing" }
                prefs.edit().putBoolean("enabled", true).commit()
                reminders.deliver("test")
                val manager = context.getSystemService(NotificationManager::class.java)
                val deadline = android.os.SystemClock.elapsedRealtime() + 3000
                while (manager.activeNotifications.none { it.tag == "test" } && android.os.SystemClock.elapsedRealtime() < deadline) android.os.SystemClock.sleep(50)
                check(manager.activeNotifications.any { it.tag == "test" }) { "Preview was not posted" }
            } finally { prefs.edit().putBoolean("enabled", wasEnabled).commit() }
            finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "Test reminder posted and left in the watch notification tray.\n") })
            return
        }
        var original: WatchSummary? = null
        var resultCode = Activity.RESULT_OK
        var resultMessage = "Reminder schedule, deduplication, posting, removal and disable checks passed.\n"
        try {
            original = WatchSummary.decode(File(context.noBackupFilesDir, "watch-summary.json").readText())
            check(SessionStorage(context).read() != null) { "Sign in the emulator before this test" }
            check(reminders.allowed) { "Grant POST_NOTIFICATIONS before this test" }
            val expected = BillReminderPlan.make(original).map { it.id }.toSet()
            reminders.enable(original)
            reminders.sync(original)
            val prefs = context.getSharedPreferences("watch-reminders", 0)
            check(prefs.getStringSet("scheduled", emptySet()) == expected) { "Schedule was duplicated or incomplete" }
            reminders.deliver("test")
            val manager = context.getSystemService(NotificationManager::class.java)
            val deadline = android.os.SystemClock.elapsedRealtime() + 3000
            while (manager.activeNotifications.none { it.tag == "test" } && android.os.SystemClock.elapsedRealtime() < deadline) android.os.SystemClock.sleep(50)
            check(manager.activeNotifications.any { it.tag == "test" }) { "Test notification was not posted" }
            reminders.sync(original)
            android.os.SystemClock.sleep(150)
            check(manager.activeNotifications.any { it.tag == "test" }) { "Routine refresh cleared a delivered test notification" }
            val bill = original.reminderSource.first()
            val tag = "bill-due-${bill.dueDate}"
            val billIDs = original.reminderSource.filter { it.dueDate == bill.dueDate }.map { it.id }
            manager.notify(tag, 0, android.app.Notification.Builder(context, BillReminders.CHANNEL)
                .setSmallIcon(R.drawable.ic_bill_reminder).setContentTitle("Bill reminder regression test")
                .addExtras(Bundle().apply { putStringArrayList("billIDs", ArrayList(billIDs)) }).build())
            val postedDeadline = android.os.SystemClock.elapsedRealtime() + 3000
            while (manager.activeNotifications.none { it.tag == tag } && android.os.SystemClock.elapsedRealtime() < postedDeadline) android.os.SystemClock.sleep(50)
            check(manager.activeNotifications.any { it.tag == tag })
            reminders.sync(original)
            android.os.SystemClock.sleep(150)
            check(manager.activeNotifications.any { it.tag == tag }) { "Routine refresh removed an unchanged bill alert" }
            reminders.sync(original.copy(reminderBills = emptyList()))
            val removedDeadline = android.os.SystemClock.elapsedRealtime() + 3000
            while (manager.activeNotifications.any { it.tag == tag } && android.os.SystemClock.elapsedRealtime() < removedDeadline) android.os.SystemClock.sleep(50)
            check(manager.activeNotifications.none { it.tag == tag }) { "Paid bill alert was not removed" }
            val today = java.time.Instant.now().atZone(original.timezone).toLocalDate().toString()
            val delayedID = "bill-due-$today"
            prefs.edit().putStringSet("scheduled", setOf(delayedID)).commit()
            reminders.sync(original.copy(bills = listOf(original.bills.first().copy(dueDate = today)), reminderBills = null))
            check(prefs.getStringSet("scheduled", emptySet())!!.contains(delayedID)) { "Refresh cancelled an inexact alarm still awaiting delivery" }
            reminders.sync(original.copy(bills = emptyList(), reminderBills = emptyList()))
            check(prefs.getStringSet("scheduled", emptySet())!!.isEmpty()) { "Removed bills still scheduled" }
            reminders.disable()
            val clearDeadline = android.os.SystemClock.elapsedRealtime() + 3000
            while (manager.activeNotifications.isNotEmpty() && android.os.SystemClock.elapsedRealtime() < clearDeadline) android.os.SystemClock.sleep(50)
            check(manager.activeNotifications.isEmpty()) { "Disable left notifications behind" }
            check(!reminders.enabled)

        } catch (error: Throwable) {
            resultCode = Activity.RESULT_CANCELED
            resultMessage = "Reminder test failed: ${error.message}\n"
        } finally {
            if (wasEnabled && original != null) reminders.enable(original) else reminders.disable()
        }
        finish(resultCode, Bundle().apply { putString("stream", resultMessage) })
    }
}
