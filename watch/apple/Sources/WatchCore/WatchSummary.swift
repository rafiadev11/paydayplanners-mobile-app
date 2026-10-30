import Foundation

public struct WatchSummary: Codable, Equatable, Sendable {
    public struct Payday: Codable, Equatable, Sendable {
        public let date: String
        public let amountMinor: Int
    }
    public struct Bill: Codable, Equatable, Identifiable, Sendable {
        public let id: String
        public let name: String
        public let dueDate: String
        public let amountMinor: Int
        public let unfundedMinor: Int
        public let overdue: Bool
    }
    public let schemaVersion: Int
    public let planningRevision: Int
    public let generatedAt: String
    public let validUntil: String
    public let timezone: String
    public let currency: String
    public let asOfDate: String
    public let nextPayday: Payday?
    public let dueBeforePaydayMinor: Int?
    public let dueOnPaydayMinor: Int?
    public let overdueCount: Int
    public let nextBill: Bill?
    public let fundingWarning: Bill?
    public let reminderBills: [Bill]?
    public var reminderSource: [Bill] { reminderBills ?? bills }
    public let bills: [Bill]
    public let totalBillCount: Int
    public let capabilities: [String]

    public static func decode(_ data: Data) throws -> WatchSummary {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let summary = try decoder.decode(Self.self, from: data)
        guard summary.schemaVersion == 1,
              TimeZone(identifier: summary.timezone) != nil,
              ISO8601DateFormatter().date(from: summary.validUntil) != nil,
              ISO8601DateFormatter().date(from: summary.generatedAt) != nil else {
            throw SummaryError.unsupported
        }
        let dates = (summary.bills + (summary.reminderBills ?? [])).map(\.dueDate) + [summary.nextPayday?.date, summary.nextBill?.dueDate, summary.fundingWarning?.dueDate].compactMap { $0 }
        guard dates.allSatisfy({ summary.daysUntil($0) != nil }) else { throw SummaryError.unsupported }
        return summary
    }
    public enum SummaryError: Error { case unsupported }

    public var generatedAtDate: Date { ISO8601DateFormatter().date(from: generatedAt) ?? .distantPast }

    public func isStale(at date: Date = Date()) -> Bool {
        guard let expiry = ISO8601DateFormatter().date(from: validUntil) else { return true }
        return date >= expiry
    }

    public func daysUntil(_ day: String, now: Date = Date()) -> Int? {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timezone) ?? .gmt
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.isLenient = false
        guard let date = formatter.date(from: day), formatter.string(from: date) == day else { return nil }
        return calendar.dateComponents([.day], from: calendar.startOfDay(for: now), to: date).day
    }

    public func dateLabel(_ day: String, now: Date = Date()) -> String {
        guard let days = daysUntil(day, now: now) else { return "Date unavailable" }
        if days == 0 { return "Today" }
        if days == 1 { return "Tomorrow" }
        if days == -1 { return "Yesterday" }
        let input = DateFormatter()
        input.locale = Locale(identifier: "en_US_POSIX")
        input.timeZone = TimeZone(identifier: timezone)
        input.dateFormat = "yyyy-MM-dd"
        guard let date = input.date(from: day) else { return "Date unavailable" }
        let output = DateFormatter()
        output.timeZone = input.timeZone
        output.setLocalizedDateFormatFromTemplate(abs(days) < 7 ? "EEE" : "MMM d")
        return output.string(from: date)
    }

    public func dueLabel(_ bill: Bill, now: Date = Date()) -> String {
        guard let days = daysUntil(bill.dueDate, now: now) else { return "Date unavailable" }
        if days < 0 { return "\(-days)\(days == -1 ? " day" : " days") overdue" }
        return "Due \(dateLabel(bill.dueDate, now: now).lowercased())"
    }

    public func needsRefresh(lastAttempt: Date?, now: Date = Date()) -> Bool {
        guard let lastAttempt else { return true }
        return now.timeIntervalSince(lastAttempt) >= 30
    }

    public func money(_ minor: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        formatter.maximumFractionDigits = minor % 100 == 0 ? 0 : 2
        return formatter.string(from: NSDecimalNumber(value: minor).dividing(by: 100)) ?? "—"
    }

    public func supersedes(_ previous: WatchSummary) -> Bool {
        if planningRevision != previous.planningRevision { return planningRevision > previous.planningRevision }
        let parser = ISO8601DateFormatter()
        guard let currentDate = parser.date(from: generatedAt), let previousDate = parser.date(from: previous.generatedAt) else { return false }
        return currentDate >= previousDate
    }
}

public struct BillReminderPlan: Equatable, Sendable {
    public let id: String
    public let date: Date
    public let billIDs: [String]

    public static func obsoleteDeliveredIdentifiers(_ delivered: [String: [String]], summary: WatchSummary) -> [String] {
        let validBills = Dictionary(grouping: summary.reminderSource, by: { "bill-due-\($0.dueDate)" }).mapValues { Set($0.map(\.id)) }
        return delivered.compactMap { id, billIDs in
            id.hasPrefix("bill-due-") && Set(billIDs) != validBills[id] ? id : nil
        }.sorted()
    }

    /// One grouped alert per account-calendar day, bounded to seven days of the last sync.
    public static func make(summary: WatchSummary, now: Date = Date()) -> [BillReminderPlan] {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: summary.timezone) ?? .gmt
        let horizon = calendar.date(byAdding: .day, value: 7, to: summary.generatedAtDate)!
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        let groups = Dictionary(grouping: summary.reminderSource, by: \.dueDate)
        return groups.compactMap { day, bills -> BillReminderPlan? in
            guard let due = formatter.date(from: day),
                  let date = calendar.date(bySettingHour: 9, minute: 0, second: 0, of: due),
                  date > now, date <= horizon else { return nil }
            return BillReminderPlan(id: "bill-due-\(day)", date: date, billIDs: Array(Set(bills.map(\.id))).sorted())
        }.sorted { $0.date < $1.date }
    }
}
