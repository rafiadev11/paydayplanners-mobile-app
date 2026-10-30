package com.paydayplanners.pairing

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import com.google.android.gms.wearable.*
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.KeyStore
import java.text.SimpleDateFormat
import java.util.Locale
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal object PairingInbox {
  private fun expiry(value: String): Long = requireNotNull(SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).parse(value)).time
  var changed: (() -> Unit)? = null
  private fun key(): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (store.getKey("payday-pairing-inbox", null) as? SecretKey)?.let { return it }
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder("payday-pairing-inbox", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
    }.generateKey()
  }
  private fun read(context: Context): List<JSONObject> = runCatching {
    val file = File(context.noBackupFilesDir, "watch-pairing-inbox")
    if (!file.exists()) return emptyList()
    val bytes = file.readBytes()
    val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12))) }
    val array = JSONArray(cipher.doFinal(bytes.copyOfRange(12, bytes.size)).toString(Charsets.UTF_8))
    (0 until array.length()).map { array.getJSONObject(it) }.filter { expiry(it.getString("expires_at")) > System.currentTimeMillis() }
  }.getOrDefault(emptyList())
  private fun write(context: Context, items: List<JSONObject>) {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
    val target = File(context.noBackupFilesDir, "watch-pairing-inbox")
    val temporary = File(context.noBackupFilesDir, "watch-pairing-inbox.tmp")
    temporary.writeBytes(cipher.iv + cipher.doFinal(JSONArray(items).toString().toByteArray()))
    check(temporary.renameTo(target))
  }
  @Synchronized fun pending(context: Context): String = JSONArray(read(context).filter { !it.optBoolean("handled") }).toString()
  @Synchronized fun dismiss(context: Context, id: String) { write(context, read(context).map { if (id == "*" || it.optString("request_id") == id) it.put("handled", true) else it }) }
  @Synchronized fun receive(context: Context, payload: JSONObject) {
    val id = payload.getString("request_id")
    java.util.UUID.fromString(id)
    require(payload.getString("approval_handle").length == 64)
    val deadline = expiry(payload.getString("expires_at"))
    require(deadline > System.currentTimeMillis() && deadline <= System.currentTimeMillis() + 660_000)
    val items = read(context)
    if (items.any { it.optString("request_id") == id }) return
    val clean = JSONObject()
    listOf("request_id", "approval_handle", "expires_at", "platform", "api_base").forEach { clean.put(it, payload.getString(it)) }
    write(context, (items + clean).takeLast(4))
    changed?.invoke()
  }
}

class PairingListener : WearableListenerService() {
  override fun onMessageReceived(event: MessageEvent) {
    if (event.path != "/payday/pairing/v2/request" || event.data.size > 4096) return
    runCatching { PairingInbox.receive(this, JSONObject(event.data.toString(Charsets.UTF_8))) }
  }
}

class WatchPairingModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WatchPairing")
    Events("requestsChanged")
    OnCreate { PairingInbox.changed = { sendEvent("requestsChanged", emptyMap<String, Any>()) } }
    OnDestroy { PairingInbox.changed = null }
    AsyncFunction("getPending") { PairingInbox.pending(requireNotNull(appContext.reactContext)) }
    AsyncFunction("dismiss") { id: String -> PairingInbox.dismiss(requireNotNull(appContext.reactContext), id) }
    AsyncFunction("probe") {
      val context = requireNotNull(appContext.reactContext)
      Wearable.getCapabilityClient(context).getCapability("payday_watch_pairing_v2", CapabilityClient.FILTER_REACHABLE).addOnSuccessListener { capability ->
        capability.nodes.forEach { node -> Wearable.getMessageClient(context).sendMessage(node.id, "/payday/pairing/v2/probe", byteArrayOf()) }
      }
    }
  }
}
