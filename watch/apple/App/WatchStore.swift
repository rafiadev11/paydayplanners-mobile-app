import Foundation
import Security
import SwiftUI

@MainActor
final class WatchStore: ObservableObject {
    let reminders = BillReminders()
    @Published private(set) var summary: WatchSummary?
    @Published private(set) var message: String?
    @Published private(set) var refreshing = false
    @Published private(set) var connectionCode: String?
    @Published private(set) var linking = false
    @Published private(set) var connected = false
    private var lastAttempt: Date?
    private let cacheURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("watch-summary.json")

    init() {
        connected = (try? credential()) != nil
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

    func connect() async {
        guard !linking else { return }
        linking = true
        message = nil
        defer { linking = false; connectionCode = nil }
        do {
            guard let baseString = Bundle.main.object(forInfoDictionaryKey: "PaydayAPIBaseURL") as? String,
                  let base = URL(string: baseString), base.scheme == "https" else { throw URLError(.badURL) }
            let start = try await linkRequest(base.appendingPathComponent("watch/link"), body: ["platform": "watchos"])
            guard let secret = start["secret"] as? String, let code = start["code"] as? String else { throw URLError(.cannotParseResponse) }
            connectionCode = code
            message = "On your phone, open Account → Connect your watch."
            for _ in 0..<120 {
                try await Task.sleep(for: .seconds(5))
                let status = try await linkRequest(base.appendingPathComponent("watch/link/status"), body: ["secret": secret])
                if let token = status["token"] as? String, status["status"] as? String == "approved" {
                    let value = try JSONEncoder().encode(Credential(apiBaseURL: baseString, token: token))
                    let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "com.paydayplanners.watch", kSecAttrAccount as String: "session"]
                    SecItemDelete(query as CFDictionary)
                    var attributes = query
                    attributes[kSecValueData as String] = value
                    attributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
                    guard SecItemAdd(attributes as CFDictionary, nil) == errSecSuccess else { throw URLError(.cannotWriteToFile) }
                    await reminders.disable()
                    connected = true
                    lastAttempt = nil
                    summary = nil
                    try? FileManager.default.removeItem(at: cacheURL)
                    linking = false
                    await refresh()
                    return
                }
            }
            message = "Code expired. Request a new code."
        } catch is CancellationError {
            message = nil
        } catch {
            message = "Unable to connect. Try again with internet access."
        }
    }

    private func linkRequest(_ url: URL, body: [String: String]) async throws -> [String: Any] {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
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
