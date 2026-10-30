import Foundation
import Security
import SwiftUI
import WatchConnectivity
import WatchKit

@MainActor
final class WatchStore: ObservableObject {
    let reminders = BillReminders()
    @Published private(set) var summary: WatchSummary?
    @Published private(set) var message: String?
    @Published private(set) var refreshing = false
    @Published private(set) var connectionCode: String?
    @Published private(set) var linking = false
    @Published private(set) var connected = false
    @Published var showManualCode = false
    private var linkGeneration = UUID()
    private var lastAttempt: Date?
    private let cacheURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("watch-summary.json")

    init() {
        WatchPairingTransport.shared.start()
        connected = (try? credential()) != nil
        if connected { Task { await acknowledgePending() } }
        if connected, let data = try? Data(contentsOf: cacheURL) { summary = try? WatchSummary.decode(data) }
    }

    func refresh(force: Bool = true) async {
        guard !refreshing && !linking else { return }
        if !force, let summary, !summary.needsRefresh(lastAttempt: lastAttempt) { return }
        lastAttempt = Date()
        let storedCredential: Credential?
        do { storedCredential = try credential() }
        catch {
            message = "Unable to access your watch session. Unlock your watch and retry."
            return
        }
        guard let credential = storedCredential else {
            await reminders.disable()
            connected = false
            summary = nil
            try? FileManager.default.removeItem(at: cacheURL)
            message = "Connect this watch from Payday Planner on your phone."
            return
        }
        connected = true
        refreshing = true
        defer { refreshing = false }
        guard let base = URL(string: credential.apiBaseURL), base.scheme == "https", base.host != nil else {
            message = "Reconnect your watch to continue."
            return
        }
        var request = URLRequest(url: base.appendingPathComponent("watch/summary"))
        request.setValue("Bearer \(credential.token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 15
        request.cachePolicy = .reloadIgnoringLocalCacheData
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let response = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
            if response.statusCode == 401 {
                await reminders.disable()
                clearSession()
                message = "Reconnect using your phone."
                return
            }
            guard response.statusCode == 200 else { throw URLError(.badServerResponse) }
            let next = try WatchSummary.decode(data)
            message = nil
            guard summary == nil || next.supersedes(summary!) else { return }
            try FileManager.default.createDirectory(at: cacheURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data.write(to: cacheURL, options: [.atomic, .completeFileProtection])
            summary = next
            message = nil
            await reminders.sync(next)
        } catch {
            if Task.isCancelled { lastAttempt = nil; return }
            message = summary == nil ? "Unable to load your plan. Try again." : "Couldn’t update · showing saved plan"
        }
    }

    func resumeConnection() async {
        if connected { await acknowledgePending() }
        else if WatchPairingTransport.shared.pending() != nil { await connect() }
    }

    func cancelConnection() {
        guard !connected else { return }
        let pending = WatchPairingTransport.shared.pending()
        linkGeneration = UUID()
        WatchPairingTransport.shared.save(nil)
        linking = false
        connectionCode = nil
        message = "Connection cancelled. Start again when you’re ready."
        if let pending, let baseString = pending["api_base"] as? String, let base = URL(string: baseString), let secret = pending["secret"] as? String {
            Task { _ = try? await linkRequest(base.appendingPathComponent("watch/link/cancel"), body: ["secret": secret]) }
        }
    }

    private func acknowledgePending() async {
        guard let pending = WatchPairingTransport.shared.pending(), let secret = pending["secret"] as? String,
              let baseString = pending["api_base"] as? String, let base = URL(string: baseString) else { return }
        if pending["protocol"] as? Int != 2 { WatchPairingTransport.shared.save(nil); return }
        if (try? await linkRequest(base.appendingPathComponent("watch/link/acknowledge"), body: ["secret": secret])) != nil {
            WatchPairingTransport.shared.save(nil)
        }
    }

    func connect() async {
        guard !linking, !connected else { return }
        let generation = UUID()
        linkGeneration = generation
        linking = true
        message = "Finding your phone…"
        showManualCode = false
        defer { if linkGeneration == generation { linking = false; connectionCode = nil } }
        do {
            guard let baseString = Bundle.main.object(forInfoDictionaryKey: "PaydayAPIBaseURL") as? String,
                  let base = URL(string: baseString), base.scheme == "https" else { throw URLError(.badURL) }
            var start = WatchPairingTransport.shared.pending()
            if start?["api_base"] as? String != baseString { start = nil }
            if start == nil {
                start = try await linkRequest(base.appendingPathComponent("watch/link"), body: ["platform": "watchos", "protocol": 2])
                start?["api_base"] = baseString
                guard linkGeneration == generation else { return }
                WatchPairingTransport.shared.save(start)
            }
            guard let start, let secret = start["secret"] as? String, let code = start["code"] as? String,
                  let expiryString = start["expires_at"] as? String, let expiry = ISO8601DateFormatter().date(from: expiryString) else { throw URLError(.cannotParseResponse) }
            connectionCode = code
            let automatic = start["protocol"] as? Int == 2
            showManualCode = !automatic
            message = automatic ? "Open Payday Planner on your phone to finish connecting." : "On your phone: Account menu → Connect your watch."
            var attempts = 0
            while expiry > Date(), linkGeneration == generation {
                if automatic && attempts % 3 == 0 { WatchPairingTransport.shared.sendPending() }
                attempts += 1
                try await Task.sleep(for: .seconds(5))
                guard linkGeneration == generation else { return }
                let status: [String: Any]
                do { status = try await linkRequest(base.appendingPathComponent("watch/link/status"), body: ["secret": secret]) }
                catch LinkFailure.expired { throw LinkFailure.expired }
                catch is CancellationError { throw CancellationError() }
                catch { message = "Waiting for a connection. Keep your phone nearby."; continue }
                guard linkGeneration == generation, !Task.isCancelled else { return }
                if let token = status["token"] as? String, status["status"] as? String == "approved" {
                    let value = try JSONEncoder().encode(Credential(apiBaseURL: baseString, token: token))
                    let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "com.paydayplanners.watch", kSecAttrAccount as String: "session"]
                    var attributes = query
                    attributes[kSecValueData as String] = value
                    attributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
                    SecItemDelete(query as CFDictionary)
                    guard SecItemAdd(attributes as CFDictionary, nil) == errSecSuccess else { throw URLError(.cannotWriteToFile) }
                    connected = true
                    linking = false
                    await reminders.disable()
                    lastAttempt = nil
                    summary = nil
                    try? FileManager.default.removeItem(at: cacheURL)
                    WKInterfaceDevice.current().play(.success)
                    await refresh()
                    await acknowledgePending()
                    return
                }
            }
            if linkGeneration == generation { WatchPairingTransport.shared.save(nil); message = "Request expired. Connect again." }
        } catch is CancellationError {
            // Keep the expiring request so setup can resume after suspension.
        } catch LinkFailure.expired {
            guard linkGeneration == generation else { return }
            WatchPairingTransport.shared.save(nil)
            message = "Request expired. Connect again."
        } catch {
            guard linkGeneration == generation else { return }
            message = "Unable to connect. Try again with internet access."
        }
    }

    private enum LinkFailure: Error { case expired }

    private func linkRequest(_ url: URL, body: [String: Any]) async throws -> [String: Any] {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        if (response as? HTTPURLResponse)?.statusCode == 410 { throw LinkFailure.expired }
        guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode),
              let result = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw URLError(.badServerResponse) }
        return result
    }

    private struct Credential: Codable { let apiBaseURL: String; let token: String }
    private func credential() throws -> Credential? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "com.paydayplanners.watch", kSecAttrAccount as String: "session", kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else { throw URLError(.userAuthenticationRequired) }
        return try JSONDecoder().decode(Credential.self, from: data)
    }
    private func clearSession() {
        SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "com.paydayplanners.watch", kSecAttrAccount as String: "session"] as CFDictionary)
        try? FileManager.default.removeItem(at: cacheURL)
        connected = false
        lastAttempt = nil
        summary = nil
    }
}

final class WatchPairingTransport: NSObject, WCSessionDelegate {
    static let shared = WatchPairingTransport()
    private let lock = NSRecursiveLock()
    private let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "com.paydayplanners.watch", kSecAttrAccount as String: "pending-link"]
    func start() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }
    func pending() -> [String: Any]? {
        lock.lock(); defer { lock.unlock() }
        var q = query
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var value: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &value) == errSecSuccess, let data = value as? Data,
              let item = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let expiry = item["expires_at"] as? String, let date = ISO8601DateFormatter().date(from: expiry), date > Date() else { return nil }
        return item
    }
    func save(_ pending: [String: Any]?) {
        lock.lock(); defer { lock.unlock() }
        if let pending, let data = try? JSONSerialization.data(withJSONObject: pending) {
            let attributes: [String: Any] = [kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
            if SecItemUpdate(query as CFDictionary, attributes as CFDictionary) == errSecItemNotFound {
                SecItemAdd(query.merging(attributes) { _, new in new } as CFDictionary, nil)
            }
        } else {
            SecItemDelete(query as CFDictionary)
            if WCSession.isSupported() { WCSession.default.outstandingUserInfoTransfers.forEach { $0.cancel() } }
        }
    }
    func sendPending() {
        guard let pending = pending(), pending["protocol"] as? Int == 2, WCSession.default.activationState == .activated else { return }
        var payload: [String: Any] = ["kind": "pairing_request"]
        for key in ["request_id", "approval_handle", "expires_at", "platform", "api_base"] { payload[key] = pending[key] }
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(payload, replyHandler: nil, errorHandler: { _ in })
        } else if WCSession.default.outstandingUserInfoTransfers.isEmpty {
            WCSession.default.transferUserInfo(payload)
        }
    }
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) { sendPending() }
    func sessionReachabilityDidChange(_ session: WCSession) { sendPending() }
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        if message["kind"] as? String == "pairing_probe" { sendPending() }
    }
}
