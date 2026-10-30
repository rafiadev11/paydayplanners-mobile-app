import SwiftUI
import UserNotifications

@MainActor
final class BillReminders: NSObject, ObservableObject, UNUserNotificationCenterDelegate {
    @Published private(set) var enabled = UserDefaults.standard.bool(forKey: "watch.billReminders")
    @Published private(set) var status = "Watch reminders are off."
    @Published private(set) var busy = false
    private let center = UNUserNotificationCenter.current()
    private var generation = 0

    override init() {
        super.init()
        center.delegate = self
        if enabled { status = "Reminders use your last synced plan." }
    }

    func setEnabled(_ value: Bool, summary: WatchSummary?) async {
        guard !busy else { return }
        if !value { await disable(); return }
        guard let summary, !summary.isStale() else {
            status = "Refresh your plan before enabling reminders."
            return
        }
        busy = true
        let version = generation
        defer { busy = false }
        do {
            guard try await center.requestAuthorization(options: [.alert, .sound]) else {
                status = "Allow notifications in watch settings to enable reminders."
                return
            }
            guard generation == version else { return }
            enabled = true
            UserDefaults.standard.set(true, forKey: "watch.billReminders")
            await sync(summary)
        } catch { status = "Couldn’t enable reminders. Please try again." }
    }

    func disable() async {
        generation += 1
        enabled = false
        UserDefaults.standard.set(false, forKey: "watch.billReminders")
        center.removeAllPendingNotificationRequests()
        center.removeAllDeliveredNotifications()
        status = "Watch reminders are off."
    }

    func sync(_ summary: WatchSummary) async {
        guard enabled else { return }
        generation += 1
        let version = generation
        let settings = await center.notificationSettings()
        guard version == generation, enabled else { return }
        guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else {
            center.removeAllPendingNotificationRequests()
            status = "Notifications are blocked in watch settings."
            return
        }
        let plan = BillReminderPlan.make(summary: summary)
        let pending = await center.pendingNotificationRequests()
        guard version == generation, enabled else { return }
        let ids = Set(plan.map(\.id))
        center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier).filter { $0.hasPrefix("bill-due-") && !ids.contains($0) })
        let delivered = await center.deliveredNotifications()
        guard version == generation, enabled else { return }
        let deliveredBills = Dictionary(uniqueKeysWithValues: delivered.map {
            ($0.request.identifier, $0.request.content.userInfo["billIDs"] as? [String] ?? [])
        })
        center.removeDeliveredNotifications(withIdentifiers: BillReminderPlan.obsoleteDeliveredIdentifiers(deliveredBills, summary: summary))
        var count = 0
        do {
            for reminder in plan {
                guard version == generation, enabled else { return }
                let content = UNMutableNotificationContent()
                content.title = reminder.billIDs.count == 1 ? "Bill due today" : "Bills due today"
                content.body = "\(reminder.billIDs.count) \(reminder.billIDs.count == 1 ? "bill is" : "bills are") due in your saved plan. Open Payday to review."
                content.sound = .default
                content.userInfo = ["billIDs": reminder.billIDs]
                var calendar = Calendar(identifier: .gregorian)
                calendar.timeZone = TimeZone(identifier: summary.timezone) ?? .gmt
                var components = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: reminder.date)
                components.timeZone = calendar.timeZone
                try await center.add(UNNotificationRequest(identifier: reminder.id, content: content, trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: false)))
                if version != generation || !enabled {
                    center.removePendingNotificationRequests(withIdentifiers: [reminder.id])
                    return
                }
                count += 1
            }
            status = count == 0 ? "No upcoming reminder dates in the next 7 days." : "\(count) reminder \(count == 1 ? "date" : "dates") scheduled."
        } catch { status = "Some reminders couldn’t be scheduled. Refresh to retry." }
    }

    func sendTest() async {
        guard enabled else { return }
        let content = UNMutableNotificationContent()
        content.title = "Payday reminder test"
        content.body = "Your watch is ready for bill reminders."
        content.sound = .default
        do {
            try await center.add(UNNotificationRequest(identifier: "bill-reminder-test", content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 5, repeats: false)))
            status = "Test reminder scheduled in 5 seconds."
        } catch { status = "Couldn’t send the test reminder." }
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        await MainActor.run { NotificationCenter.default.post(name: Notification.Name("PaydayOpenSummary"), object: nil) }
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }
}

struct ReminderSettings: View {
    @ObservedObject var store: WatchStore
    @ObservedObject var reminders: BillReminders
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Toggle("Bill reminders", isOn: Binding(get: { reminders.enabled }, set: { value in
                    Task { await reminders.setEnabled(value, summary: store.summary) }
                })).disabled(reminders.busy || !store.connected)
                Text("Around 9 a.m. on the due date, in your account’s timezone.").font(.caption)
                Text("One alert per day for bills in the next 7 days. Open the watch app to keep the schedule current; offline alerts use the last synced plan.").font(.caption2).foregroundStyle(.secondary)
                Text("If phone notifications already appear on your watch, leave these off to avoid duplicate alerts.").font(.caption2).foregroundStyle(.orange)
                Text(reminders.status).font(.caption2).accessibilityLabel(reminders.status)
                if reminders.enabled {
                    Button("Send test reminder") { Task { await reminders.sendTest() } }
                }
            }
        }.navigationTitle("Reminders").toolbarTitleDisplayMode(.inline)
    }
}
