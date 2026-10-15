import AppIntents
import SwiftUI
import WidgetKit

struct DoitTasksWidget: Widget {
  static let kind = "com.osbyrne.doit.tasks"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: Self.kind, provider: DoitTasksTimelineProvider()) { entry in
      DoitTasksWidgetView(entry: entry)
    }
    .configurationDisplayName("Doit Tasks")
    .description("See your tasks, complete or delete them, and open Doit to add or edit.")
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}

private struct DoitTasksEntry: TimelineEntry {
  let date: Date
  let todos: [DoitTodo]
  let errorMessage: String?
}

private struct DoitTasksTimelineProvider: TimelineProvider {
  func placeholder(in context: Context) -> DoitTasksEntry {
    DoitTasksEntry(
      date: Date(),
      todos: [
        DoitTodo(id: "sample-1", title: "Review today’s tasks", completed: false, createdAt: ""),
        DoitTodo(id: "sample-2", title: "Plan the week", completed: false, createdAt: ""),
      ],
      errorMessage: nil
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (DoitTasksEntry) -> Void) {
    Task {
      completion(await makeEntry())
    }
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<DoitTasksEntry>) -> Void) {
    Task {
      let entry = await makeEntry()
      completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(15 * 60))))
    }
  }

  private func makeEntry() async -> DoitTasksEntry {
    do {
      let todos = try await DoitAPI.fetchTodos()
      return DoitTasksEntry(date: Date(), todos: todos, errorMessage: nil)
    } catch {
      return DoitTasksEntry(date: Date(), todos: [], errorMessage: error.localizedDescription)
    }
  }
}

private struct DoitTasksWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: DoitTasksEntry

  private var openTodos: [DoitTodo] {
    entry.todos
      .filter { !$0.completed }
      .sorted { $0.createdAt > $1.createdAt }
  }

  private var visibleCount: Int {
    family == .systemLarge ? 7 : 4
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack {
        Label("Doit", systemImage: "checklist")
          .font(.headline)
        Spacer()
        Link(destination: DoitAPI.newTodoURL) {
          Image(systemName: "plus")
            .accessibilityLabel("Add a task in Doit")
        }
        Link(destination: DoitAPI.tasksURL) {
          Image(systemName: "arrow.up.right")
            .accessibilityLabel("Open all tasks in Doit")
        }
      }

      if let errorMessage = entry.errorMessage {
        Text(errorMessage)
          .font(.subheadline)
          .foregroundStyle(.secondary)
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      } else if openTodos.isEmpty {
        Text("You’re all caught up.")
          .font(.subheadline)
          .foregroundStyle(.secondary)
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      } else {
        ForEach(Array(openTodos.prefix(visibleCount)), id: \.id) { todo in
          HStack(spacing: 9) {
            Button(intent: CompleteTodoIntent(todoID: todo.id)) {
              Image(systemName: "circle")
                .font(.title3)
                .accessibilityLabel("Mark \(todo.title) as done")
            }
            .buttonStyle(.plain)

            Link(destination: DoitAPI.editURL(for: todo.id)) {
              Text(todo.title)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Edit \(todo.title) in Doit")

            Button(intent: DeleteTodoIntent(todoID: todo.id)) {
              Image(systemName: "trash")
                .foregroundStyle(.secondary)
                .accessibilityLabel("Delete \(todo.title)")
            }
            .buttonStyle(.plain)
          }
        }
      }
    }
    .padding()
    .containerBackground(.background, for: .widget)
    .widgetURL(DoitAPI.tasksURL)
  }
}

struct CompleteTodoIntent: AppIntent {
  static var title: LocalizedStringResource = "Complete task"
  static var description = IntentDescription("Marks a Doit task as done.")

  @Parameter(title: "Task ID")
  var todoID: String

  init() {}

  init(todoID: String) {
    self.todoID = todoID
  }

  func perform() async throws -> some IntentResult {
    try await DoitAPI.setCompleted(todoID, completed: true)
    return .result()
  }
}

struct DeleteTodoIntent: AppIntent {
  static var title: LocalizedStringResource = "Delete task"
  static var description = IntentDescription("Deletes a Doit task.")

  @Parameter(title: "Task ID")
  var todoID: String

  init() {}

  init(todoID: String) {
    self.todoID = todoID
  }

  func perform() async throws -> some IntentResult {
    try await DoitAPI.deleteTodo(todoID)
    return .result()
  }
}
