import AppIntents

enum DoitAppDestination: String, AppEnum {
  case taskList

  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Doit screen"
  static var caseDisplayRepresentations: [DoitAppDestination: DisplayRepresentation] = [
    .taskList: "Task list",
  ]
}

struct OpenTasksIntent: OpenIntent {
  static var title: LocalizedStringResource = "Open Doit tasks"
  static var description = IntentDescription("Opens Doit to the task list.")

  @Parameter(title: "Destination")
  var target: DoitAppDestination

  init() {
    target = .taskList
  }

  func perform() async throws -> some IntentResult {
    .result()
  }
}
