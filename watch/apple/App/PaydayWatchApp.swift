import SwiftUI

@main
struct PaydayWatchApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var store = WatchStore()
    var body: some Scene {
        WindowGroup {
            SummaryView(store: store)
                .task(id: scenePhase) {
                    guard scenePhase == .active else { return }
                    await store.resumeConnection()
                    while !Task.isCancelled {
                        await store.refresh(force: false)
                        do { try await Task.sleep(for: .seconds(60)) }
                        catch { return }
                    }
                }
        }
    }
}
