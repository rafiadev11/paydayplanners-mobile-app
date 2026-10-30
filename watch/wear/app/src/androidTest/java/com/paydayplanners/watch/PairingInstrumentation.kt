package com.paydayplanners.watch

import android.app.Activity
import android.app.Instrumentation
import android.os.Bundle
import org.json.JSONObject
import java.io.File
import java.security.KeyStore
import java.time.Instant

/** Exercises the actual Android Keystore and private storage on an emulator/device. */
class PairingInstrumentation : Instrumentation() {
    override fun onCreate(arguments: Bundle?) { super.onCreate(arguments); start() }
    override fun onStart() {
        var code = Activity.RESULT_OK
        var message = "Pairing encryption, storage isolation, expiry, environment and private-payload checks passed.\n"
        val first = SessionStorage(targetContext, "pairing-test-session")
        val second = SessionStorage(targetContext, "pairing-test-pending")
        try {
            first.save("restricted-watch-token-test")
            second.save("private-polling-secret-test")
            check(first.read() == "restricted-watch-token-test") { "Pending storage overwrote the active credential" }
            check(second.read() == "private-polling-secret-test")
            val file = File(targetContext.noBackupFilesDir, "pairing-test-pending")
            check(!file.readText().contains("private-polling-secret-test")) { "Private request was stored as plaintext" }
            first.clear()
            check(second.read() == "private-polling-secret-test") { "Clearing a session removed another store" }
            val corrupted = file.readBytes().apply { this[lastIndex] = (this[lastIndex].toInt() xor 1).toByte() }
            file.writeBytes(corrupted)
            check(runCatching { second.read() }.isFailure) { "Tampered ciphertext was accepted" }

            val now = Instant.now()
            val request = JSONObject().put("protocol", 2).put("request_id", "f460a141-1111-4444-aaaa-123456789abc")
                .put("approval_handle", "a".repeat(64)).put("expires_at", now.plusSeconds(600).toString())
                .put("platform", "wearos").put("api_base", BuildConfig.API_BASE_URL)
                .put("secret", "must-stay-on-watch").put("code", "12345678")
            val envelope = JSONObject(String(WatchPairingTransport.publicEnvelope(request)!!, Charsets.UTF_8))
            check(!envelope.has("secret") && !envelope.has("code") && envelope.length() == 5) { "Private credential escaped to the phone" }
            check(WatchPairingTransport.decodePending(request.toString(), now) != null)
            check(WatchPairingTransport.decodePending(request.toString(), now.plusSeconds(601)) == null) { "Expired setup resumed" }
            request.put("api_base", "https://other.invalid/api/v1")
            check(WatchPairingTransport.decodePending(request.toString(), now) == null) { "A different backend's request resumed" }
            check(WatchPairingTransport.decodePending("invalid", now) == null)
            request.put("protocol", 1)
            check(WatchPairingTransport.publicEnvelope(request) == null) { "Legacy pairing used automatic transport" }
        } catch (error: Throwable) {
            code = Activity.RESULT_CANCELED
            message = "Pairing test failed: ${error.message}\n"
        } finally {
            first.clear(); second.clear()
            KeyStore.getInstance("AndroidKeyStore").apply { load(null); deleteEntry("payday-pairing-test-session"); deleteEntry("payday-pairing-test-pending") }
        }
        finish(code, Bundle().apply { putString("stream", message) })
    }
}
