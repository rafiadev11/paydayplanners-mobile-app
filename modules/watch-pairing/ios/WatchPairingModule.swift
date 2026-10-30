import ExpoModulesCore
import UIKit
import WatchConnectivity
import Security

private let pairingChanged = Notification.Name("PaydayPairingChanged")

final class PhoneWatchSession: NSObject, WCSessionDelegate {
  static let shared = PhoneWatchSession()
  private let lock = NSRecursiveLock()
  private let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "com.paydayplanners.pairing", kSecAttrAccount as String: "requests"]

  func start() {
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }
  func probe() {
    guard WCSession.isSupported(), WCSession.default.activationState == .activated, WCSession.default.isReachable else { return }
    WCSession.default.sendMessage(["kind": "pairing_probe"], replyHandler: nil, errorHandler: { _ in })
  }
  private func read() -> [[String: Any]] {
    var q = query
    q[kSecReturnData as String] = true
    q[kSecMatchLimit as String] = kSecMatchLimitOne
    var value: CFTypeRef?
    guard SecItemCopyMatching(q as CFDictionary, &value) == errSecSuccess, let data = value as? Data,
          let items = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { return [] }
    return items.filter { item in
      guard let expiry = item["expires_at"] as? String, let date = ISO8601DateFormatter().date(from: expiry) else { return false }
      return date > Date()
    }
  }
  private func write(_ items: [[String: Any]]) {
    guard let data = try? JSONSerialization.data(withJSONObject: items) else { return }
    let attributes: [String: Any] = [kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
    if SecItemUpdate(query as CFDictionary, attributes as CFDictionary) == errSecItemNotFound {
      SecItemAdd(query.merging(attributes) { _, new in new } as CFDictionary, nil)
    }
  }
  func pending() -> String {
    lock.lock(); defer { lock.unlock() }
    let items = read().filter { ($0["handled"] as? Bool) != true }
    return String(data: (try? JSONSerialization.data(withJSONObject: items)) ?? Data("[]".utf8), encoding: .utf8) ?? "[]"
  }
  func dismiss(_ id: String) {
    lock.lock(); defer { lock.unlock() }
    write(read().map { item in
      var next = item
      if id == "*" || item["request_id"] as? String == id { next["handled"] = true }
      return next
    })
  }
  private func receive(_ payload: [String: Any]) {
    guard payload["kind"] as? String == "pairing_request", let id = payload["request_id"] as? String,
          UUID(uuidString: id) != nil, let handle = payload["approval_handle"] as? String, handle.count == 64,
          let expiry = payload["expires_at"] as? String, let date = ISO8601DateFormatter().date(from: expiry),
          date > Date(), date.timeIntervalSinceNow <= 660 else { return }
    lock.lock()
    var items = read()
    if items.contains(where: { $0["request_id"] as? String == id }) { lock.unlock(); return }
    var clean: [String: Any] = [:]
    for key in ["request_id", "approval_handle", "expires_at", "platform", "api_base"] { clean[key] = payload[key] as? String }
    items.append(clean)
    write(Array(items.suffix(4)))
    lock.unlock()
    NotificationCenter.default.post(name: pairingChanged, object: nil)
  }
  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) { probe() }
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) { dismiss("*"); session.activate() }
  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) { receive(message) }
  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) { receive(userInfo) }
}

public final class WatchPairingAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    PhoneWatchSession.shared.start()
    return true
  }
}

public final class WatchPairingModule: Module {
  private var observer: NSObjectProtocol?
  public func definition() -> ModuleDefinition {
    Name("WatchPairing")
    Events("requestsChanged")
    OnCreate {
      PhoneWatchSession.shared.start()
      self.observer = NotificationCenter.default.addObserver(forName: pairingChanged, object: nil, queue: .main) { [weak self] _ in self?.sendEvent("requestsChanged", [:]) }
    }
    OnDestroy { if let observer = self.observer { NotificationCenter.default.removeObserver(observer) } }
    AsyncFunction("getPending") { PhoneWatchSession.shared.pending() }
    AsyncFunction("dismiss") { (id: String) in PhoneWatchSession.shared.dismiss(id) }
    AsyncFunction("probe") { PhoneWatchSession.shared.probe() }
  }
}
