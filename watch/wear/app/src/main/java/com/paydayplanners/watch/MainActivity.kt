package com.paydayplanners.watch

import android.os.Bundle
import android.os.Build
import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.viewModels
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.rotary.onRotaryScrollEvent
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.*
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.format.DateTimeFormatter

private val Mint = Color(0xFFB8F3CD)
private val Amber = Color(0xFFFFD29A)
private val Muted = Color(0xFFA8B4AC)
private val Card = Color(0xFF17241C)

class MainActivity : ComponentActivity() {
    private val store: WatchStore by viewModels()
    private var refreshJob: Job? = null
    override fun onResume() {
        super.onResume()
        refreshJob = lifecycleScope.launch {
            while (true) { store.refresh(force = false); delay(60_000) }
        }
    }
    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        if (intent.action == "com.paydayplanners.watch.OPEN_BILLS") store.openFromNotification()
    }
    override fun onPause() { refreshJob?.cancel(); super.onPause() }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (intent.action == "com.paydayplanners.watch.OPEN_BILLS") store.openFromNotification()
        setContent { MaterialTheme { SummaryScreen(store) } }
    }
}

@Composable
private fun WatchCard(title: String, subtitle: String, accent: Color = Mint, onClick: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().heightIn(min = 48.dp).background(Card, RoundedCornerShape(18.dp))
            .clickable(role = Role.Button, onClick = onClick).padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(title, color = accent, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
        Text(subtitle, color = Muted, fontSize = 11.sp, textAlign = TextAlign.Center)
    }
}

@Composable
private fun SummaryScreen(store: WatchStore) {
    val summary = store.summary
    var reminderSettings by rememberSaveable { mutableStateOf(false) }
    val context = LocalContext.current
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) store.setReminders(true) else store.reminderPermissionDenied()
    }
    var selectedBillID by rememberSaveable { mutableStateOf<String?>(null) }
    LaunchedEffect(store.notificationOpened) { if (store.notificationOpened > 0) { selectedBillID = null; reminderSettings = false } }
    var now by remember { mutableStateOf(Instant.now()) }
    LaunchedEffect(Unit) { while (true) { now = Instant.now(); delay(30_000) } }
    LaunchedEffect(store.connected) { if (!store.connected) { selectedBillID = null; reminderSettings = false } }
    BackHandler(selectedBillID != null || reminderSettings) { selectedBillID = null; reminderSettings = false }
    val state = rememberScalingLazyListState(initialCenterItemIndex = 0)
    val focus = remember { FocusRequester() }
    val scope = rememberCoroutineScope()
    LaunchedEffect(selectedBillID, reminderSettings) { state.scrollToItem(0); focus.requestFocus() }
    Box(Modifier.fillMaxSize().background(Color.Black)) {
        ScalingLazyColumn(
            state = state,
            autoCentering = null,
            modifier = Modifier.fillMaxSize().onRotaryScrollEvent {
                scope.launch { state.scrollBy(it.verticalScrollPixels) }; true
            }.focusRequester(focus).focusable(),
            contentPadding = PaddingValues(horizontal = 24.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item { Text(if (reminderSettings) "REMINDERS" else if (selectedBillID == null) "PAYDAY" else "BILL DETAILS", color = Mint, fontSize = 10.sp, fontWeight = FontWeight.SemiBold) }
            if (reminderSettings) {
                item { Text("Bill reminders", fontSize = 18.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center) }
                item { WatchCard(if (store.remindersEnabled) "Turn reminders off" else "Turn reminders on", if (store.remindersEnabled) "On for this watch" else "Off for this watch") {
                    if (store.remindersEnabled) store.setReminders(false)
                    else if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) permission.launch(Manifest.permission.POST_NOTIFICATIONS)
                    else store.setReminders(true)
                } }
                item { Text("Around 9 a.m. on the due date, in your account’s timezone. Wear OS may delay alerts to save battery.", color = Muted, fontSize = 12.sp, textAlign = TextAlign.Center) }
                item { Text("One alert per day for bills in the next 7 days. Open the watch app to refresh; offline alerts use the last synced plan.", color = Muted, fontSize = 12.sp, textAlign = TextAlign.Center) }
                item { Text("If phone alerts already appear on your watch, leave these off to avoid duplicates.", color = Amber, fontSize = 12.sp, textAlign = TextAlign.Center) }
                item { Text(store.reminderStatus, color = Mint, fontSize = 12.sp, textAlign = TextAlign.Center) }
                if (store.remindersEnabled) item { WatchCard("Send test reminder", "Try an alert on this watch", onClick = store::sendTestReminder) }
                item { WatchCard("Back to summary", "Payday & bills") { reminderSettings = false } }
            } else if (selectedBillID != null) {
                val bill = summary?.let { (it.bills + listOfNotNull(it.warning)).firstOrNull { bill -> bill.id == selectedBillID } }
                if (bill != null) {
                    item { Text(bill.name, fontSize = 18.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center) }
                    item { Text(summary.money(bill.amountMinor), color = Mint, fontSize = 28.sp, fontWeight = FontWeight.Bold) }
                    item { Text(summary.dueLabel(bill, now), color = Muted, fontSize = 13.sp, textAlign = TextAlign.Center) }
                    if (summary.isStale(now)) item { Text("Saved plan · refresh needed", color = Amber, fontSize = 11.sp, textAlign = TextAlign.Center) }
                    item { Text(if (bill.unfundedMinor > 0) "${summary.money(bill.unfundedMinor)} not covered" else "Covered in your plan", color = if (bill.unfundedMinor > 0) Amber else Mint, textAlign = TextAlign.Center) }
                    item { Text("Manage payments and changes on your phone.", color = Muted, fontSize = 12.sp, textAlign = TextAlign.Center) }
                } else item { Text("This bill is no longer in your upcoming plan.", textAlign = TextAlign.Center) }
                item { WatchCard("Back to summary", "Payday & upcoming bills") { selectedBillID = null } }
            } else if (summary != null) {
                store.message?.let { item { Text(it, color = Amber, fontSize = 11.sp, textAlign = TextAlign.Center) } }
                if (summary.isStale(now)) item { Text("Saved plan · refresh needed", color = Amber, fontSize = 11.sp, textAlign = TextAlign.Center) }
                item {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        val payday = summary.nextPayday
                        if (payday == null) {
                            Text("No upcoming payday", fontSize = 18.sp, textAlign = TextAlign.Center)
                            Text("Add income on your phone", color = Muted, fontSize = 12.sp, textAlign = TextAlign.Center)
                        } else {
                            val days = summary.daysUntil(payday.date, now)
                            Text(when { days < 0 -> "Previous forecast"; days == 0L -> "Payday today"; days == 1L -> "Payday tomorrow"; else -> "Payday in $days days" }, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Mint, textAlign = TextAlign.Center)
                            Text("${summary.money(payday.amountMinor)} expected · ${summary.dateLabel(payday.date, now)}", fontSize = 12.sp, color = Muted, textAlign = TextAlign.Center)
                        }
                        summary.dueBeforePaydayMinor?.let { amount ->
                            Spacer(Modifier.height(3.dp))
                            Text("${summary.money(amount)} in bills", fontSize = 13.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.Center)
                            Text("before payday", fontSize = 11.sp, color = Muted, textAlign = TextAlign.Center)
                        }
                    }
                }
                summary.bills.firstOrNull()?.let { bill ->
                    item { WatchCard("Next: ${bill.name}", "${summary.money(bill.amountMinor)} · ${summary.dueLabel(bill, now)}") { selectedBillID = bill.id } }
                }
                summary.warning?.let { warning ->
                    item { WatchCard(if (summary.isStale(now)) "Saved funding estimate" else "Needs funding", "${warning.name} · ${summary.money(warning.unfundedMinor)} short", Amber) { selectedBillID = warning.id } }
                }
                summary.dueOnPaydayMinor?.takeIf { it > 0 }?.let { amount -> item { Text("Plus ${summary.money(amount)} due on payday", color = Muted, fontSize = 11.sp, textAlign = TextAlign.Center) } }
                if (summary.bills.isEmpty()) item { Text("No unpaid bills", color = Mint, fontSize = 13.sp) }
                summary.bills.drop(1).forEach { bill ->
                    item(key = bill.id) { WatchCard(bill.name, "${summary.money(bill.amountMinor)} · ${summary.dueLabel(bill, now)}") { selectedBillID = bill.id } }
                }
                if (summary.totalBillCount > summary.bills.size) item {
                    Text("Showing the next ${summary.bills.size} bills. See all on your phone.", color = Muted, fontSize = 11.sp, textAlign = TextAlign.Center)
                }
            } else if (store.connected) {
                item { Text(if (store.message == null) "Loading your plan" else "Plan unavailable", fontSize = 18.sp, textAlign = TextAlign.Center) }
                item { Text("Your watch is connected.", color = Muted, fontSize = 12.sp) }
            } else {
                item { Text("Your payday, at a glance", fontSize = 18.sp, textAlign = TextAlign.Center) }
                store.connectionCode?.let { code -> item { Text(code, color = Mint, fontSize = 24.sp, fontWeight = FontWeight.Bold) } }
                item { Button(onClick = store::connect, enabled = !store.linking, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp), colors = ButtonDefaults.buttonColors(containerColor = Card, contentColor = Mint)) { Text(if (store.linking) "Waiting for phone…" else "Connect with phone", fontSize = 12.sp, textAlign = TextAlign.Center) } }
            }
            if (summary == null) store.message?.let { item { Text(it, color = Muted, fontSize = 11.sp, textAlign = TextAlign.Center) } }
            if (store.connected && selectedBillID == null && !reminderSettings) {
                item { WatchCard("Bill reminders", if (store.remindersEnabled) "On for this watch" else "Set up due-day alerts") { reminderSettings = true } }
                item { Button(onClick = { store.refresh() }, enabled = !store.refreshing && !store.linking, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp), colors = ButtonDefaults.buttonColors(containerColor = Card, contentColor = Mint)) { Text(if (store.refreshing) "Updating…" else "Refresh", fontSize = 13.sp) } }
                summary?.let { item { Text("Updated ${DateTimeFormatter.ofPattern("h:mm a").withZone(it.timezone).format(it.generatedAt)}", color = Muted, fontSize = 10.sp) } }
            }
        }
    }
}
