import SwiftUI
import WidgetKit

private let paydayMint = Color(red: 0.72, green: 0.95, blue: 0.80)

private struct LauncherEntry: TimelineEntry {
    let date: Date
}

private struct LauncherProvider: TimelineProvider {
    func placeholder(in context: Context) -> LauncherEntry { LauncherEntry(date: .now) }
    func getSnapshot(in context: Context, completion: @escaping (LauncherEntry) -> Void) {
        completion(LauncherEntry(date: .now))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<LauncherEntry>) -> Void) {
        // A static shortcut needs no account access or scheduled refreshes.
        completion(Timeline(entries: [LauncherEntry(date: .now)], policy: .never))
    }
}

private struct PaydayMark: View {
    var body: some View {
        GeometryReader { geometry in
            Path { path in
                let scale = min(geometry.size.width, geometry.size.height) / 24
                let transform = CGAffineTransform(scaleX: scale, y: scale)
                var mark = Path()
                mark.move(to: CGPoint(x: 4, y: 3))
                mark.addLine(to: CGPoint(x: 11, y: 3))
                mark.addCurve(to: CGPoint(x: 11, y: 13), control1: CGPoint(x: 18, y: 3), control2: CGPoint(x: 18, y: 13))
                for point in [CGPoint(x: 7, y: 13), CGPoint(x: 7, y: 19), CGPoint(x: 4, y: 19)] {
                    mark.addLine(to: point)
                }
                mark.closeSubpath()
                mark.addRect(CGRect(x: 7, y: 6, width: 4, height: 4))
                mark.move(to: CGPoint(x: 14, y: 8))
                mark.addLine(to: CGPoint(x: 16, y: 8))
                mark.addCurve(to: CGPoint(x: 16, y: 18), control1: CGPoint(x: 23, y: 8), control2: CGPoint(x: 23, y: 18))
                for point in [CGPoint(x: 13, y: 18), CGPoint(x: 13, y: 23), CGPoint(x: 10, y: 23), CGPoint(x: 10, y: 15), CGPoint(x: 16, y: 15)] {
                    mark.addLine(to: point)
                }
                mark.addCurve(to: CGPoint(x: 16, y: 11), control1: CGPoint(x: 19, y: 15), control2: CGPoint(x: 19, y: 11))
                mark.addLine(to: CGPoint(x: 14, y: 11))
                mark.closeSubpath()
                path.addPath(mark, transform: transform)
            }.fill(style: FillStyle(eoFill: true))
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityHidden(true)
    }
}

private struct LauncherView: View {
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            switch family {
            case .accessoryInline:
                Label("Payday", systemImage: "calendar")
            case .accessoryRectangular:
                HStack(spacing: 8) {
                    PaydayMark().frame(width: 32, height: 32)
                        .foregroundStyle(paydayMint).widgetAccentable()
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Payday Planner").font(.headline).minimumScaleFactor(0.7)
                        Label("Open app", systemImage: "arrow.up.forward")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
            case .accessoryCorner:
                PaydayMark().padding(4).foregroundStyle(paydayMint).widgetAccentable()
                    .widgetLabel { Text("Payday") }
            default:
                ZStack {
                    AccessoryWidgetBackground()
                    PaydayMark().padding(8).foregroundStyle(paydayMint).widgetAccentable()
                }
            }
        }
        // WidgetKit opens the containing watch app when any part is tapped.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Open Payday Planner")
        .containerBackground(for: .widget) { Color(red: 0.09, green: 0.14, blue: 0.11) }
    }
}

@main
struct PaydayWatchWidgets: Widget {
    let kind = "com.paydayplanners.watch.launcher"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LauncherProvider()) { _ in LauncherView() }
            .configurationDisplayName("Open Payday Planner")
            .description("Open your payday and bills with one tap.")
            .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline, .accessoryCorner])
    }
}
