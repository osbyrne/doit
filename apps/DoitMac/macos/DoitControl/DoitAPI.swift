import Foundation

struct DoitTodo: Decodable {
  let id: String
  let title: String
  let completed: Bool
  let createdAt: String
}

private struct TodoListResponse: Decodable {
  let todos: [DoitTodo]
}

enum DoitAPIError: Error {
  case invalidResponse
  case requestFailed(Int)
}

enum DoitAPI {
  private static let endpoint = URL(string: "https://doit.osbyrne.workers.dev/api/todos")!

  static func fetchTodos() async throws -> [DoitTodo] {
    let (data, response) = try await URLSession.shared.data(from: endpoint)
    try validate(response)
    return try JSONDecoder().decode(TodoListResponse.self, from: data).todos
  }

  static func setCompleted(_ id: String, completed: Bool) async throws {
    var request = URLRequest(url: endpoint.appendingPathComponent(id))
    request.httpMethod = "PATCH"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONEncoder().encode(CompletionUpdate(completed: completed))
    let (_, response) = try await URLSession.shared.data(for: request)
    try validate(response)
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
