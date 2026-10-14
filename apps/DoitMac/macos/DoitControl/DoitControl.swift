import AppIntents
import SwiftUI
import WidgetKit

struct DoitControl: ControlWidget {
  static let kind = "com.osbyrne.doit.complete-next"

  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: Self.kind) {
      ControlWidgetButton(action: CompleteNextTodoIntent()) {
        Label("Complete next todo", systemImage: "checkmark.circle")
      }
    }
    .displayName("Complete next todo")
    .description("Mark the oldest open todo as complete.")
  }
}

@main
struct DoitControlBundle: WidgetBundle {
  var body: some Widget {
    DoitControl()
  }
}

struct CompleteNextTodoIntent: AppIntent {
  static var title: LocalizedStringResource = "Complete next todo"
  static var description = IntentDescription("Completes the oldest open todo in Doit.")

  func perform() async throws -> some IntentResult {
    let todos = try await DoitAPI.fetchTodos()
    guard let next = todos.filter({ !$0.completed }).min(by: { $0.createdAt < $1.createdAt }) else {
      return .result()
    }
    try await DoitAPI.setCompleted(next.id, completed: true)
    return .result()
  }
}
