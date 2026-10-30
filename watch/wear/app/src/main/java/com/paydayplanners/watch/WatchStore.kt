package com.paydayplanners.watch

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.net.URL
import javax.net.ssl.HttpsURLConnection

class WatchStore(application: Application) : AndroidViewModel(application) {
    var notificationOpened by mutableStateOf(0)
        private set
    fun openFromNotification() { notificationOpened += 1; refresh() }
    private val reminders = BillReminders(application)
    var remindersEnabled by mutableStateOf(reminders.enabled)
        private set
    var reminderStatus by mutableStateOf(if (reminders.enabled) "Reminders use your last synced plan." else "Watch reminders are off.")
        private set
    fun setReminders(enabled: Boolean) {
        if (!enabled) { reminders.disable(); reminderStatus = "Watch reminders are off." }
        else {
            val plan = summary
            reminderStatus = if (!connected || plan == null) "Connect and refresh your plan first." else reminders.enable(plan)
        }
        remindersEnabled = reminders.enabled
    }
    fun reminderPermissionDenied() { reminderStatus = "Allow notifications in watch settings to enable reminders." }
    fun sendTestReminder() { reminderStatus = reminders.test() }
    private fun clearReminders() { reminders.disable(); remindersEnabled = false; reminderStatus = "Watch reminders are off." }
    private val cache = File(application.noBackupFilesDir, "watch-summary.json")
    var summary by mutableStateOf<WatchSummary?>(null)
        private set
    var message by mutableStateOf<String?>(null)
        private set
    var refreshing by mutableStateOf(false)
        private set
    var connectionCode by mutableStateOf<String?>(null)
        private set
    var linking by mutableStateOf(false)
        private set
    var connected by mutableStateOf(false)
        private set
    private var ready = false
    private var lastAttempt: java.time.Instant? = null
    private var linkJob: Job? = null
    var showManualCode by mutableStateOf(false)
    private var linkGeneration = 0L
    private var foreground = false
    private var committingSession = false
    fun setForeground(active: Boolean) {
        foreground = active
        if (!active) stopLinking()
        else if (ready && !connected && WatchPairingTransport.pending(getApplication()) != null) connect()
    }
    fun stopLinking() { if (committingSession) return; linkGeneration++; linkJob?.cancel(); linking = false; connectionCode = null }
    fun cancelConnection() {
        if (connected || committingSession) return
        stopLinking()
        val pending = WatchPairingTransport.pending(getApplication())
        SessionStorage(getApplication(), "watch-pending-link").clear()
        connectionCode = null
        linking = false
        message = "Connection cancelled. Start again when you’re ready."
        if (pending != null) viewModelScope.launch { runCatching { linkRequest("watch/link/cancel", JSONObject().put("secret", pending.getString("secret"))) } }
    }
    private suspend fun acknowledgePending() {
        val pending = WatchPairingTransport.pending(getApplication()) ?: return
        if (pending.optInt("protocol") != 2 || runCatching { linkRequest("watch/link/acknowledge", JSONObject().put("secret", pending.getString("secret"))) }.isSuccess) {
            SessionStorage(getApplication(), "watch-pending-link").clear()
        }
    }
    fun connect() {
        if (linking || connected) return
        val generation = ++linkGeneration
        linking = true
        showManualCode = false
        message = "Finding your phone…"
        linkJob = viewModelScope.launch {
            try {
                val start = WatchPairingTransport.pending(getApplication()) ?: linkRequest("watch/link", JSONObject().put("platform", "wearos").put("protocol", 2)).put("api_base", BuildConfig.API_BASE_URL).also {
                    SessionStorage(getApplication(), "watch-pending-link").save(it.toString())
                }
                if (generation != linkGeneration) return@launch
                connectionCode = start.getString("code")
                val automatic = start.optInt("protocol") == 2
                showManualCode = !automatic
                message = if (automatic) "Open Payday Planner on your phone to finish connecting." else "On your phone: Account menu → Connect your watch."
                val expiry = java.time.Instant.parse(start.getString("expires_at"))
                var attempts = 0
                while (expiry.isAfter(java.time.Instant.now())) {
                    if (automatic && attempts++ % 3 == 0) WatchPairingTransport.send(getApplication())
                    delay(5000)
                    val status = try { linkRequest("watch/link/status", JSONObject().put("secret", start.getString("secret"))) }
                    catch (cancelled: CancellationException) { throw cancelled }
                    catch (expired: LinkExpired) { throw expired }
                    catch (_: Exception) { message = "Waiting for a connection. Keep your phone nearby."; continue }
                    if (generation != linkGeneration) return@launch
                    if (status.optString("status") == "approved") {
                        committingSession = true
                        try {
                            withContext(Dispatchers.IO) {
                                SessionStorage(getApplication()).save(JSONObject().put("apiBaseURL", BuildConfig.API_BASE_URL).put("token", status.getString("token")).toString())
                                cache.delete()
                            }
                        } finally { committingSession = false }
                        clearReminders()
                        connected = true
                        lastAttempt = null
                        summary = null
                        linking = false
                        refresh()
                        acknowledgePending()
                        return@launch
                    }
                }
                SessionStorage(getApplication(), "watch-pending-link").clear()
                message = "Request expired. Connect again."
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: LinkExpired) {
                if (generation != linkGeneration) return@launch
                SessionStorage(getApplication(), "watch-pending-link").clear()
                message = "Request expired. Connect again."
            } catch (_: Exception) {
                if (generation != linkGeneration) return@launch
                message = "Unable to connect. Try again with internet access."
            } finally { if (generation == linkGeneration) { linking = false; connectionCode = null } }
        }
    }
    private class LinkExpired : Exception()
    private suspend fun linkRequest(path: String, body: JSONObject): JSONObject = withContext(Dispatchers.IO) {
        val connection = URL(BuildConfig.API_BASE_URL + "/" + path).openConnection() as HttpsURLConnection
        connection.requestMethod = "POST"
        connection.doOutput = true
        connection.connectTimeout = 15000
        connection.readTimeout = 15000
        connection.instanceFollowRedirects = false
        connection.setRequestProperty("Content-Type", "application/json")
        connection.setRequestProperty("Accept", "application/json")
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            if (connection.responseCode == 410) throw LinkExpired()
            check(connection.responseCode in 200..299)
            connection.inputStream.bufferedReader().use { JSONObject(it.readText()) }
        } finally { connection.disconnect() }
    }
    init {
        viewModelScope.launch {
            val sessionExists = withContext(Dispatchers.IO) {
                runCatching { SessionStorage(getApplication()).read() != null }
                    .getOrElse { File(getApplication<Application>().noBackupFilesDir, "watch-session").exists() }
            }
            connected = sessionExists
            summary = if (sessionExists) withContext(Dispatchers.IO) {
                runCatching { WatchSummary.decode(cache.readText()) }.getOrNull()
            } else null
            if (!sessionExists) { clearReminders(); withContext(Dispatchers.IO) { cache.delete() } }
            ready = true
            if (connected) acknowledgePending()
            if (foreground && !connected && WatchPairingTransport.pending(getApplication()) != null) connect() else refresh()
        }
    }
    fun refresh(force: Boolean = true) {
        if (!ready || refreshing || linking) return
        val now = java.time.Instant.now()
        if (!force && summary?.needsRefresh(lastAttempt, now) == false) return
        lastAttempt = now
        refreshing = true
        viewModelScope.launch {
            try {
                val raw = withContext(Dispatchers.IO) {
                    val session = SessionStorage(getApplication()).read() ?: throw NotLinked()
                    val credential = JSONObject(session)
                    val url = URL(credential.getString("apiBaseURL").trimEnd('/') + "/watch/summary")
                    require(url.protocol == "https")
                    val connection = url.openConnection() as HttpsURLConnection
                    connection.connectTimeout = 15000
                    connection.readTimeout = 15000
                    connection.instanceFollowRedirects = false
                    connection.setRequestProperty("Authorization", "Bearer " + credential.getString("token"))
                    connection.setRequestProperty("Accept", "application/json")
                    try {
                        if (connection.responseCode == 401) throw NotLinked()
                        check(connection.responseCode == 200)
                        connection.inputStream.bufferedReader().use { it.readText() }
                    } finally { connection.disconnect() }
                }
                connected = true
                val next = WatchSummary.decode(raw)
                if (summary == null || next.supersedes(summary!!)) {
                    withContext(Dispatchers.IO) {
                        val temporary = File(cache.parentFile, "watch-summary.tmp")
                        temporary.writeText(raw)
                        check(temporary.renameTo(cache))
                    }
                    summary = next
                }
                summary?.let { reminderStatus = reminders.sync(it) }
                message = null
            } catch (_: NotLinked) {
                withContext(Dispatchers.IO) { cache.delete(); SessionStorage(getApplication()).clear() }
                clearReminders()
                connected = false
                summary = null
                message = "Connect this watch from Payday Planner on your phone."
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                message = if (summary == null) "Unable to load your plan. Try again." else "Couldn’t update · showing saved plan"
            } finally { refreshing = false }
        }
    }
    private class NotLinked : Exception()
}
