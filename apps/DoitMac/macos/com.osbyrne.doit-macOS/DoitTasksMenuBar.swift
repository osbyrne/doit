import SwiftUI

struct DoitTasksMenuBar: View {
  @State private var todos: [DoitTodo] = []
  @State private var busyIDs = Set<String>()
  @State private var isLoading = false
  @State private var errorMessage: String?

  private var openTodos: [DoitTodo] {
    todos
      .filter { !$0.completed }
      .sorted { $0.createdAt > $1.createdAt }
  }

  private var completedTodos: [DoitTodo] {
    todos
      .filter(\.completed)
      .sorted { $0.createdAt > $1.createdAt }
  }

  var body: some View {
    VStack(spacing: 0) {
      HStack {
        Label("Doit tasks", systemImage: "checklist")
          .font(.headline)
        Spacer()
        Button {
          Task { await refresh() }
        } label: {
          Image(systemName: "arrow.clockwise")
        }
        .buttonStyle(.borderless)
        .help("Refresh tasks")
        .disabled(isLoading)
      }
      .padding(.horizontal, 14)
      .padding(.vertical, 12)

      Divider()

      Group {
        if isLoading && todos.isEmpty {
          ProgressView("Loading tasks…")
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let errorMessage {
          VStack(spacing: 10) {
            Text(errorMessage)
              .foregroundStyle(.secondary)
              .multilineTextAlignment(.center)
            Button("Try again") {
              Task { await refresh() }
            }
          }
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .padding()
        } else if todos.isEmpty {
          Text("You’re all caught up.")
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
          ScrollView {
            LazyVStack(alignment: .leading, spacing: 2) {
              if !openTodos.isEmpty {
                sectionTitle("TO DO")
                ForEach(openTodos, id: \.id) { todo in
                  taskRow(todo)
                }
              }

              if !completedTodos.isEmpty {
                sectionTitle("COMPLETED")
                  .padding(.top, 10)
                ForEach(completedTodos, id: \.id) { todo in
                  taskRow(todo)
                }
              }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
          }
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)

      Divider()

      Link(destination: DoitAPI.tasksURL) {
        HStack {
          Text("Open Doit")
          Spacer()
          Image(systemName: "arrow.up.right")
        }
        .font(.callout)
      }
      .buttonStyle(.plain)
      .padding(.horizontal, 14)
      .padding(.vertical, 11)
    }
    .frame(width: 340, height: 450)
    .task {
      if todos.isEmpty { await refresh() }
    }
  }

  private func sectionTitle(_ title: String) -> some View {
    Text(title)
      .font(.caption2.weight(.semibold))
      .foregroundStyle(.secondary)
      .padding(.horizontal, 7)
      .padding(.top, 6)
      .padding(.bottom, 3)
  }

  private func taskRow(_ todo: DoitTodo) -> some View {
    HStack(spacing: 9) {
      Button {
        Task { await toggle(todo) }
      } label: {
        Image(systemName: todo.completed ? "checkmark.circle.fill" : "circle")
          .foregroundStyle(todo.completed ? Color.accentColor : Color.secondary)
          .frame(width: 20, height: 24)
          .contentShape(Rectangle())
      }
      .buttonStyle(.borderless)
      .disabled(busyIDs.contains(todo.id))
      .help(todo.completed ? "Mark as not done" : "Mark as done")

      Link(destination: DoitAPI.editURL(for: todo.id)) {
        Text(todo.title)
          .lineLimit(2)
          .frame(maxWidth: .infinity, alignment: .leading)
          .foregroundStyle(todo.completed ? .secondary : .primary)
          .strikethrough(todo.completed)
          .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .help("Open this task in Doit to edit it")
    }
    .padding(.horizontal, 7)
    .padding(.vertical, 5)
  }

  @MainActor
  private func refresh() async {
    isLoading = true
    defer { isLoading = false }
    do {
      todos = try await DoitAPI.fetchTodos()
      errorMessage = nil
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  @MainActor
  private func toggle(_ todo: DoitTodo) async {
    busyIDs.insert(todo.id)
    defer { busyIDs.remove(todo.id) }
    do {
      try await DoitAPI.setCompleted(todo.id, completed: !todo.completed)
      todos = todos.map { item in
        guard item.id == todo.id else { return item }
        return DoitTodo(
          id: item.id,
          title: item.title,
          completed: !item.completed,
          createdAt: item.createdAt
        )
      }
      errorMessage = nil
    } catch {
      errorMessage = error.localizedDescription
    }
  }
}
