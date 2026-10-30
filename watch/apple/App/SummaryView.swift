import SwiftUI

private let paydayMint = Color(red: 0.72, green: 0.95, blue: 0.80)
private let paydayCard = Color(red: 0.09, green: 0.14, blue: 0.11)

struct SummaryView: View {
    @ObservedObject var store: WatchStore
    @State private var navigationID = UUID()
    @State private var connectionTask: Task<Void, Never>?

    var body: some View {
        NavigationStack {
            TimelineView(.periodic(from: .now, by: 60)) { context in
                ScrollView {
                    VStack(alignment: .leading, spacing: 10) {
                        if let summary = store.summary {
                            if let message = store.message { Text(message).font(.caption2).foregroundStyle(.orange) }
                            if summary.isStale(at: context.date) {
                                Label("Saved plan · refresh needed", systemImage: "clock")
                                    .font(.caption2).foregroundStyle(.orange)
                            }
                            if let payday = summary.nextPayday {
                                Text(paydayTitle(summary, payday.date, now: context.date))
                                    .font(.system(.title3, design: .rounded).bold())
                                    .foregroundStyle(paydayMint).fixedSize(horizontal: false, vertical: true)
                                Text("\(summary.money(payday.amountMinor)) expected · \(summary.dateLabel(payday.date, now: context.date))")
                                    .font(.caption).foregroundStyle(.secondary)
                            } else {
                                Text("No upcoming payday").font(.headline)
                                Text("Add income on your phone to see your forecast.").font(.caption).foregroundStyle(.secondary)
                            }
                            if let amount = summary.dueBeforePaydayMinor {
                                Divider()
                                (Text(summary.money(amount)).bold() + Text(" in bills before then"))
                                    .font(.caption).fixedSize(horizontal: false, vertical: true)
                            }
                            if let bill = summary.nextBill {
                                billLink(bill, summary: summary, title: "NEXT BILL", now: context.date)
                            } else {
                                Label("No unpaid bills", systemImage: "checkmark.circle").font(.caption).foregroundStyle(paydayMint)
                            }
                            if let warning = summary.fundingWarning {
                                NavigationLink {
                                    BillDetail(billID: warning.id, store: store)
                                } label: {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Label(summary.isStale(at: context.date) ? "Saved funding estimate" : "Needs funding", systemImage: "exclamationmark.triangle")
                                            .font(.caption2.bold())
                                        Text("\(warning.name) · \(summary.money(warning.unfundedMinor)) short").font(.caption2)
                                    }.foregroundStyle(.orange).frame(maxWidth: .infinity, alignment: .leading).padding(10)
                                        .background(Color.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
                                }.buttonStyle(.plain)
                            }
                            if let onPayday = summary.dueOnPaydayMinor, onPayday > 0 {
                                Text("Plus \(summary.money(onPayday)) due on payday").font(.caption2).foregroundStyle(.secondary)
                            }
                            ForEach(summary.bills.filter { $0.id != summary.nextBill?.id }) { bill in
                                billLink(bill, summary: summary, title: nil, now: context.date)
                            }
                            if summary.totalBillCount > summary.bills.count {
                                Text("Showing the next \(summary.bills.count) bills. See all on your phone.").font(.caption2).foregroundStyle(.secondary)
                            }
                        } else if store.connected {
                            Label(store.message == nil ? "Loading your plan" : "Plan unavailable", systemImage: "arrow.triangle.2.circlepath").font(.headline)
                            Text("Your watch is connected.").font(.caption).foregroundStyle(.secondary)
                        } else {
                            Image(systemName: "applewatch").font(.title2).foregroundStyle(paydayMint)
                            Text("Your payday, at a glance").font(.headline)
                            if let code = store.connectionCode {
                                Text(code).font(.title3.monospacedDigit().bold())
                                    .accessibilityLabel("Connection code \(code.map(String.init).joined(separator: " "))")
                                Text("On your phone: Account menu → Connect your watch").font(.caption2).foregroundStyle(.secondary)
                            }
                            Button(store.linking ? "Waiting for phone…" : "Connect with phone") {
                                connectionTask = Task { await store.connect() }
                            }.disabled(store.linking)
                        }
                        if store.summary == nil, let message = store.message {
                            Text(message).font(.caption2).foregroundStyle(.secondary).accessibilityLabel(message)
                        }
                        if store.connected {
                            NavigationLink { ReminderSettings(store: store, reminders: store.reminders) } label: {
                                Label("Bill reminders", systemImage: "bell")
                            }.font(.caption)
                            Button { Task { await store.refresh() } } label: {
                                Label(store.refreshing ? "Updating…" : "Refresh", systemImage: "arrow.clockwise")
                            }.disabled(store.refreshing || store.linking)
                            if let summary = store.summary {
                                Text("Updated \(summary.generatedAtDate.formatted(date: .omitted, time: .shortened))")
                                    .font(.caption2).foregroundStyle(.secondary).frame(maxWidth: .infinity)
                            }
                        }
                    }.padding(.horizontal, 4).padding(.bottom, 12)
                }
            }.navigationTitle("Payday").toolbarTitleDisplayMode(.inline).containerBackground(.black, for: .navigation)
        }.id(navigationID).onReceive(NotificationCenter.default.publisher(for: Notification.Name("PaydayOpenSummary"))) { _ in navigationID = UUID() }.tint(paydayMint).onDisappear { connectionTask?.cancel() }
    }

    private func billLink(_ bill: WatchSummary.Bill, summary: WatchSummary, title: String?, now: Date) -> some View {
        NavigationLink { BillDetail(billID: bill.id, store: store) } label: {
            VStack(alignment: .leading, spacing: 3) {
                if let title { Text(title).font(.system(size: 9, weight: .semibold)).foregroundStyle(paydayMint) }
                Text("\(bill.name) · \(summary.money(bill.amountMinor))").font(.caption.bold())
                Text(summary.dueLabel(bill, now: now)).font(.caption2).foregroundStyle(.secondary)
            }.frame(maxWidth: .infinity, alignment: .leading).padding(10)
                .background(paydayCard, in: RoundedRectangle(cornerRadius: 14))
        }.buttonStyle(.plain)
    }

    private func paydayTitle(_ summary: WatchSummary, _ date: String, now: Date) -> String {
        guard let days = summary.daysUntil(date, now: now) else { return "Next payday" }
        if days < 0 { return "Previous forecast" }
        if days == 0 { return "Payday today" }
        if days == 1 { return "Payday tomorrow" }
        return "Payday in \(days) days"
    }
}

private struct BillDetail: View {
    let billID: String
    @ObservedObject var store: WatchStore
    var body: some View {
        TimelineView(.periodic(from: .now, by: 60)) { context in
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if let summary = store.summary, let bill = (summary.bills + [summary.fundingWarning, summary.nextBill].compactMap { $0 }).first(where: { $0.id == billID }) {
                        Text(bill.name).font(.headline)
                        Text(summary.money(bill.amountMinor)).font(.system(.largeTitle, design: .rounded).bold()).minimumScaleFactor(0.7)
                        Text(summary.dueLabel(bill, now: context.date)).font(.caption).foregroundStyle(.secondary)
                        if summary.isStale(at: context.date) { Label("Saved plan", systemImage: "clock").font(.caption).foregroundStyle(.orange) }
                        Label(bill.unfundedMinor > 0 ? "\(summary.money(bill.unfundedMinor)) not covered" : "Covered in your plan", systemImage: bill.unfundedMinor > 0 ? "exclamationmark.triangle" : "checkmark.circle")
                            .font(.caption).foregroundStyle(bill.unfundedMinor > 0 ? .orange : paydayMint)
                        Text("Manage payments and changes on your phone.").font(.caption2).foregroundStyle(.secondary)
                    } else {
                        Text(store.connected ? "This bill is no longer in your upcoming plan." : "Reconnect your watch to view bills.").font(.caption)
                    }
                }.frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 4)
            }
        }.navigationTitle("Bill details").toolbarTitleDisplayMode(.inline)
    }
}
