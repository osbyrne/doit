import AppIntents
import SwiftUI
import WidgetKit

struct DoitControl: ControlWidget {
  // Keep the original kind stable so existing Control Center placements keep working.
  static let kind = "com.osbyrne.doit.complete-next"

  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: Self.kind) {
      ControlWidgetButton(action: OpenTasksIntent()) {
        Label("Open Doit tasks", systemImage: "checklist")
      }
    }
    .displayName("Open Doit tasks")
    .description("Open your scrollable task list in Doit.")
  }
}

@main
struct DoitControlBundle: WidgetBundle {
  var body: some Widget {
    DoitControl()
    DoitTasksWidget()
  }
}
