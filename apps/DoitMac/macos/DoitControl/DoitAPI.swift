import Foundation
import WidgetKit

struct DoitTodo: Decodable {
  let id: String
  let title: String
  let completed: Bool
  let createdAt: String
}

private struct TodoListResponse: Decodable {
  let todos: [DoitTodo]
}

enum DoitAPIError: LocalizedError {
  case notAuthenticated
  case invalidTitle
  case invalidResponse
  case requestFailed(Int)

  var message: String {
    switch self {
    case .notAuthenticated:
      return "Open Doit and sign in to see your tasks."
    case .invalidTitle:
      return "Task titles must be between 1 and 240 characters."
    case .invalidResponse:
      return "Doit returned an invalid response."
    case let .requestFailed(status):
      return status == 401
        ? "Your Doit session expired. Open the app and sign in again."
        : "The Doit request failed (\(status))."
    }
  }

  var errorDescription: String? { message }
}

enum DoitAPI {
  static let appGroup = "group.com.osbyrne.doit"
  private static let sessionKey = "betterAuthSessionToken"
  private static let endpoint = URL(string: "https://doit.osbyrne.workers.dev/api/todos")!

  static var tasksURL: URL {
    var components = URLComponents()
    components.scheme = "com.osbyrne.doit"
    components.host = "todos"
    return components.url!
  }

  static var newTodoURL: URL {
    var components = URLComponents()
    components.scheme = "com.osbyrne.doit"
    components.host = "todos"
    components.queryItems = [URLQueryItem(name: "new", value: "1")]
    return components.url!
  }

  static func editURL(for id: String) -> URL {
    var components = URLComponents()
    components.scheme = "com.osbyrne.doit"
    components.host = "todo"
    components.path = "/\(id)"
    return components.url!
  }

  static func fetchTodos() async throws -> [DoitTodo] {
    let request = try authenticatedRequest(for: endpoint)
    let (data, response) = try await URLSession.shared.data(for: request)
    try validate(response)
    return try JSONDecoder().decode(TodoListResponse.self, from: data).todos
  }

  static func setCompleted(_ id: String, completed: Bool) async throws {
    var request = try authenticatedRequest(for: endpoint.appendingPathComponent(id))
    request.httpMethod = "PATCH"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONEncoder().encode(CompletionUpdate(completed: completed))
    let (_, response) = try await URLSession.shared.data(for: request)
    try validate(response)
    WidgetCenter.shared.reloadAllTimelines()
  }

  static func updateTitle(_ id: String, title: String) async throws {
    let title = title.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !title.isEmpty, title.count <= 240 else {
      throw DoitAPIError.invalidTitle
    }

    var request = try authenticatedRequest(for: endpoint.appendingPathComponent(id))
    request.httpMethod = "PATCH"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONEncoder().encode(TitleUpdate(title: title))
    let (_, response) = try await URLSession.shared.data(for: request)
    try validate(response)
    WidgetCenter.shared.reloadAllTimelines()
  }

  static func deleteTodo(_ id: String) async throws {
    var request = try authenticatedRequest(for: endpoint.appendingPathComponent(id))
    request.httpMethod = "DELETE"
    let (_, response) = try await URLSession.shared.data(for: request)
    try validate(response)
    WidgetCenter.shared.reloadAllTimelines()
  }

  private static func authenticatedRequest(for url: URL) throws -> URLRequest {
    guard
      let token = UserDefaults(suiteName: appGroup)?.string(forKey: sessionKey),
      !token.isEmpty
    else {
      throw DoitAPIError.notAuthenticated
    }

    var request = URLRequest(url: url)
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    return request
  }

  private static func validate(_ response: URLResponse) throws {
    guard let response = response as? HTTPURLResponse else {
      throw DoitAPIError.invalidResponse
    }
    guard (200..<300).contains(response.statusCode) else {
      throw DoitAPIError.requestFailed(response.statusCode)
    }
  }
}

private struct CompletionUpdate: Encodable {
  let completed: Bool
}

private struct TitleUpdate: Encodable {
  let title: String
}
