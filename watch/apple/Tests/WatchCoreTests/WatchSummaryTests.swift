import Foundation
import XCTest
@testable import WatchCore

final class WatchSummaryTests: XCTestCase {
    private func fixture() throws -> Data {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        return try Data(contentsOf: root.appendingPathComponent("contracts/summary-v1.json"))
    }
    func testDecodesSharedContractWithoutRoundingMoney() throws {
        let summary = try WatchSummary.decode(fixture())
        XCTAssertEqual(summary.nextPayday?.amountMinor, 210000)
        XCTAssertEqual(summary.dueBeforePaydayMinor, 24500)
        XCTAssertEqual(summary.fundingWarning?.unfundedMinor, 4000)
    }
    func testCountdownUsesAccountCalendarAndDoesNotShowPastPaydayAsFuture() throws {
        let summary = try WatchSummary.decode(fixture())
        let parse = ISO8601DateFormatter()
        XCTAssertEqual(summary.daysUntil("2026-10-30", now: parse.date(from: "2026-10-28T02:00:00Z")!), 3)
        XCTAssertEqual(summary.daysUntil("2026-11-02", now: parse.date(from: "2026-11-01T04:30:00Z")!), 1)
        XCTAssertEqual(summary.daysUntil("2026-10-26", now: parse.date(from: "2026-10-27T14:00:00Z")!), -1)
        XCTAssertNil(summary.daysUntil("2026-02-30"))
    }
    func testExpiresAtAccountMidnight() throws {
        let summary = try WatchSummary.decode(fixture())
        let parse = ISO8601DateFormatter()
        XCTAssertFalse(summary.isStale(at: parse.date(from: "2026-10-28T03:59:59Z")!))
        XCTAssertTrue(summary.isStale(at: parse.date(from: "2026-10-28T04:00:00Z")!))
    }
    func testRejectsUnsupportedSchemaAndOutOfOrderUpdates() throws {
        let data = try fixture()
        let text = String(decoding: data, as: UTF8.self)
        XCTAssertThrowsError(try WatchSummary.decode(Data(text.replacingOccurrences(of: "\"schema_version\": 1", with: "\"schema_version\": 2").utf8)))
        let current = try WatchSummary.decode(data)
        let older = try WatchSummary.decode(Data(text.replacingOccurrences(of: "\"planning_revision\": 12", with: "\"planning_revision\": 11").utf8))
        XCTAssertFalse(older.supersedes(current))
        XCTAssertTrue(current.supersedes(older))
    }
    func testDueLabelsAdvanceEvenWhenCachedOverdueFlagIsFalse() throws {
        let summary = try WatchSummary.decode(fixture())
        let now = ISO8601DateFormatter().date(from: "2026-10-29T14:00:00Z")!
        XCTAssertEqual(summary.dueLabel(summary.bills[0], now: now), "1 day overdue")
        XCTAssertEqual(summary.dueLabel(summary.bills[1], now: now), "Due today")
        XCTAssertEqual(summary.dateLabel("2026-10-30", now: now), "Tomorrow")
    }
    func testRefreshCooldownAndRecovery() throws {
        let summary = try WatchSummary.decode(fixture())
        let now = Date()
        XCTAssertTrue(summary.needsRefresh(lastAttempt: nil, now: now))
        XCTAssertFalse(summary.needsRefresh(lastAttempt: now.addingTimeInterval(-29), now: now))
        XCTAssertTrue(summary.needsRefresh(lastAttempt: now.addingTimeInterval(-30), now: now))
    }
    func testRejectsInvalidBillDates() throws {
        let text = String(decoding: try fixture(), as: UTF8.self)
        XCTAssertThrowsError(try WatchSummary.decode(Data(text.replacingOccurrences(of: "2026-10-28", with: "2026-02-30").utf8)))
    }
    func testRemindersGroupBillsAtNineInAccountTimezone() throws {
        let text = String(decoding: try fixture(), as: UTF8.self).replacingOccurrences(of: "2026-10-29", with: "2026-10-28")
        let summary = try WatchSummary.decode(Data(text.utf8))
        let now = ISO8601DateFormatter().date(from: "2026-10-27T14:00:00Z")!
        let plan = BillReminderPlan.make(summary: summary, now: now)
        XCTAssertEqual(plan.count, 1)
        XCTAssertEqual(plan[0].billIDs, ["1", "2"])
        XCTAssertEqual(plan[0].date, ISO8601DateFormatter().date(from: "2026-10-28T13:00:00Z"))
        XCTAssertEqual(plan, BillReminderPlan.make(summary: summary, now: now))
        XCTAssertTrue(BillReminderPlan.make(summary: summary, now: plan[0].date).isEmpty)
    }
    func testRemindersRespectDSTAndSevenDayHorizon() throws {
        var json = try JSONSerialization.jsonObject(with: fixture()) as! [String: Any]
        json["generated_at"] = "2026-10-31T14:00:00Z"
        var bills = json["bills"] as! [[String: Any]]
        bills[0]["due_date"] = "2026-11-01"
        bills[1]["due_date"] = "2026-11-10"
        json["bills"] = bills
        let summary = try WatchSummary.decode(JSONSerialization.data(withJSONObject: json))
        let now = ISO8601DateFormatter().date(from: "2026-10-31T14:00:00Z")!
        let plan = BillReminderPlan.make(summary: summary, now: now)
        XCTAssertEqual(plan.count, 1)
        XCTAssertEqual(plan[0].date, ISO8601DateFormatter().date(from: "2026-11-01T14:00:00Z"))
        json["bills"] = []
        XCTAssertTrue(BillReminderPlan.make(summary: try WatchSummary.decode(JSONSerialization.data(withJSONObject: json)), now: now).isEmpty)
        XCTAssertTrue(BillReminderPlan.make(summary: summary, now: now.addingTimeInterval(8 * 86400)).isEmpty)
    }
    func testReminderSourceIsIndependentOfDisplayLimit() throws {
        var json = try JSONSerialization.jsonObject(with: fixture()) as! [String: Any]
        json["reminder_bills"] = json["bills"]
        json["bills"] = []
        let summary = try WatchSummary.decode(JSONSerialization.data(withJSONObject: json))
        let now = ISO8601DateFormatter().date(from: "2026-10-27T14:00:00Z")!
        XCTAssertEqual(BillReminderPlan.make(summary: summary, now: now).count, 2)
        json["reminder_bills"] = []
        let empty = try WatchSummary.decode(JSONSerialization.data(withJSONObject: json))
        XCTAssertTrue(BillReminderPlan.make(summary: empty, now: now).isEmpty)
    }
    func testRefreshPreservesUnchangedAlertsButRemovesPaidOrChangedGroups() throws {
        let summary = try WatchSummary.decode(fixture())
        let delivered = ["bill-due-2026-10-28": ["1"], "bill-due-2026-10-29": ["2", "paid"], "bill-due-2026-10-30": ["removed"], "bill-reminder-test": []]
        XCTAssertEqual(BillReminderPlan.obsoleteDeliveredIdentifiers(delivered, summary: summary), ["bill-due-2026-10-29", "bill-due-2026-10-30"])
    }
}
