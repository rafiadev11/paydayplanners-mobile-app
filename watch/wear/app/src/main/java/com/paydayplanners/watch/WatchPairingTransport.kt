package com.paydayplanners.watch

import android.content.Context
import com.google.android.gms.wearable.*
import org.json.JSONObject
import java.time.Instant

object WatchPairingTransport {
    internal fun decodePending(raw: String, now: Instant = Instant.now()): JSONObject? = runCatching {
        JSONObject(raw).takeIf { it.optString("api_base") == BuildConfig.API_BASE_URL && Instant.parse(it.getString("expires_at")).isAfter(now) }
    }.getOrNull()
    fun pending(context: Context): JSONObject? = runCatching {
        SessionStorage(context, "watch-pending-link").read()?.let { decodePending(it) }
    }.getOrNull()
    internal fun publicEnvelope(pending: JSONObject): ByteArray? {
        if (pending.optInt("protocol") != 2) return null
        val payload = JSONObject()
        listOf("request_id", "approval_handle", "expires_at", "platform", "api_base").forEach { payload.put(it, pending.getString(it)) }
        return payload.toString().toByteArray(Charsets.UTF_8)
    }
    fun send(context: Context) {
        val pending = pending(context) ?: return
        val payload = publicEnvelope(pending) ?: return
        Wearable.getCapabilityClient(context).getCapability("payday_phone_pairing_v2", CapabilityClient.FILTER_REACHABLE).addOnSuccessListener { capability ->
            capability.nodes.forEach { node ->
                Wearable.getMessageClient(context).sendMessage(node.id, "/payday/pairing/v2/request", payload).addOnFailureListener { }
            }
        }.addOnFailureListener { }
    }
}

class PairingListener : WearableListenerService() {
    override fun onMessageReceived(event: MessageEvent) {
        if (event.path == "/payday/pairing/v2/probe") WatchPairingTransport.send(this)
    }
}
