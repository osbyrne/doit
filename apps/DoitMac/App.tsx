import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Linking,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Cause, Effect, Exit, ManagedRuntime, Option } from "effect";
import { AppServicesLive, TodoService, type Todo } from "./src/effect/todos";
import { AuthService, type AuthSession } from "./src/effect/auth";
import { AuthError, type AppError } from "./src/effect/errors";
import { clearPendingURL, reloadTasksWidget, takePendingURL } from "./src/auth-client";

type AppRuntime = ManagedRuntime.ManagedRuntime<AuthService | TodoService, never>;
type AppProgram<A> = Effect.Effect<A, AppError, AuthService | TodoService>;

function todoIDFromURL(url: string): string | null {
  const match = /^com\.osbyrne\.doit:\/\/todo\/([^/?#]+)/i.exec(url);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function isTaskListURL(url: string): boolean {
  return /^com\.osbyrne\.doit:\/\/todos(?:[/?#]|$)/i.test(url);
}

function isNewTodoURL(url: string): boolean {
  return isTaskListURL(url) && /(?:\?|&)new=1(?:&|#|$)/i.test(url);
}

function launch(task: Promise<unknown>): void {
  task.catch((cause) => console.error("Unexpected Effect runtime failure.", cause));
}

function App() {
  const runtimeRef = useRef<AppRuntime | null>(null);
  const controllers = useRef(new Set<AbortController>());
  const mounted = useRef(false);
  const titleInputRef = useRef<TextInput>(null);

  const [todos, setTodos] = useState<ReadonlyArray<Todo>>([]);
  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState<Todo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const authenticatedRef = useRef(authenticated);
  authenticatedRef.current = authenticated;
  const [pendingTodoID, setPendingTodoID] = useState<string | null>(null);
  const [pendingCreate, setPendingCreate] = useState(false);

  useEffect(() => {
    const runtime = ManagedRuntime.make(AppServicesLive);
    const activeControllers = controllers.current;
    runtimeRef.current = runtime;
    mounted.current = true;

    return () => {
      mounted.current = false;
      for (const controller of activeControllers) controller.abort();
      activeControllers.clear();
      runtimeRef.current = null;
      launch(runtime.dispose());
    };
  }, []);

  const runEffect = useCallback(
    async <A,>(
      program: AppProgram<A>,
      onSuccess: (value: A) => void,
      onFailure?: (message: string) => void,
    ) => {
      const runtime = runtimeRef.current;
      if (!runtime) return;

      const controller = new AbortController();
      controllers.current.add(controller);
      const exit = await runtime
        .runPromiseExit(program, { signal: controller.signal })
        .finally(() => controllers.current.delete(controller));

      // Effects started from this screen are interrupted during unmount. The
      // mounted guard also protects callbacks backed by SDK promises that do
      // not themselves observe Effect's AbortSignal.
      if (!mounted.current || controller.signal.aborted) return;
      if (Exit.isSuccess(exit)) {
        onSuccess(exit.value);
        return;
      }

      const failure = Option.getOrUndefined(Cause.findErrorOption(exit.cause));
      const message = failure?.message ?? Cause.pretty(exit.cause);
      setError(message);
      onFailure?.(message);
    },
    [],
  );

  const refresh = useCallback(() => {
    setLoading(true);
    launch(
      runEffect(
        Effect.gen(function* () {
          const service = yield* TodoService;
          return yield* service.list();
        }),
        (items) => {
          setTodos(items);
          setError(null);
          setLoading(false);
        },
        () => setLoading(false),
      ),
    );
  }, [runEffect]);

  const acceptAuthURL = useCallback(
    (url: string) => {
      clearPendingURL();
      const linkedTodoID = todoIDFromURL(url);
      if (linkedTodoID) {
        setPendingCreate(false);
        setPendingTodoID(linkedTodoID);
        return;
      }
      if (isTaskListURL(url)) {
        if (isNewTodoURL(url)) {
          setPendingTodoID(null);
          setEditing(null);
          setTitle("");
          setError(null);
          setPendingCreate(true);
        }
        if (authenticatedRef.current) refresh();
        return;
      }

      launch(
        runEffect(
          Effect.gen(function* () {
            const auth = yield* AuthService;
            const accepted = yield* auth.acceptCallback(url);
            return accepted ? yield* auth.getSession() : null;
          }),
          (session) => {
            setAuthLoading(false);
            setAuthenticated(Boolean(session));
            if (session) refresh();
          },
          () => setAuthLoading(false),
        ),
      );
    },
    [refresh, runEffect],
  );

  useEffect(() => {
    const callback = Linking.addEventListener("url", ({ url }) => acceptAuthURL(url));
    const program = Effect.gen(function* () {
      const auth = yield* AuthService;
      yield* auth.restoreToken();
      const queuedURL = yield* Effect.tryPromise({
        try: () => takePendingURL(),
        catch: (cause) =>
          new AuthError({
            message: "Could not read the task link for this app launch.",
            cause,
          }),
      });
      const initialURL = yield* Effect.tryPromise({
        try: () => Linking.getInitialURL(),
        catch: (cause) =>
          new AuthError({
            message: "Could not read the app launch URL.",
            cause,
          }),
      });
      const url = queuedURL ?? initialURL;
      const linkedTodoID = url ? todoIDFromURL(url) : null;
      const createNewTodo = url ? isNewTodoURL(url) : false;
      if (url && !linkedTodoID && !isTaskListURL(url)) yield* auth.acceptCallback(url);
      return { session: yield* auth.getSession(), linkedTodoID, createNewTodo };
    });

    launch(
      runEffect(
        program,
        ({
          session,
          linkedTodoID,
          createNewTodo,
        }: {
          session: AuthSession | null;
          linkedTodoID: string | null;
          createNewTodo: boolean;
        }) => {
          if (linkedTodoID) setPendingTodoID(linkedTodoID);
          if (createNewTodo) {
            setTitle("");
            setEditing(null);
            setPendingCreate(true);
          }
          setAuthenticated(Boolean(session));
          setAuthLoading(false);
          if (session) refresh();
          else setLoading(false);
        },
        () => {
          setAuthLoading(false);
          setLoading(false);
        },
      ),
    );

    return () => callback.remove();
  }, [acceptAuthURL, refresh, runEffect]);

  useEffect(() => {
    if (!pendingCreate || !authenticated || loading) return;
    titleInputRef.current?.focus();
    setPendingCreate(false);
  }, [authenticated, loading, pendingCreate]);

  const openBrowserAuth = () => {
    if (authBusy) return;
    setAuthBusy(true);
    setError(null);
    launch(
      runEffect(
        Effect.gen(function* () {
          const auth = yield* AuthService;
          yield* auth.openBrowserAuth();
        }),
        () => setAuthBusy(false),
        () => setAuthBusy(false),
      ),
    );
  };

  const signOut = () => {
    if (authBusy) return;
    setAuthBusy(true);
    launch(
      runEffect(
        Effect.gen(function* () {
          const auth = yield* AuthService;
          yield* auth.signOut();
        }),
        () => {
          setAuthenticated(false);
          setTodos([]);
          setEditing(null);
          setTitle("");
          setAuthBusy(false);
        },
        () => {
          setAuthenticated(false);
          setTodos([]);
          setAuthBusy(false);
        },
      ),
    );
  };

  const submit = () => {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    setError(null);
    launch(
      runEffect(
        Effect.gen(function* () {
          const service = yield* TodoService;
          return yield* service.save(nextTitle, editing?.id);
        }),
        (saved) => {
          setTodos((current) =>
            editing
              ? current.map((todo) => (todo.id === saved.id ? saved : todo))
              : [saved, ...current],
          );
          setTitle("");
          setEditing(null);
          setError(null);
          Keyboard.dismiss();
          reloadTasksWidget();
        },
      ),
    );
  };

  const toggle = (todo: Todo) => {
    setError(null);
    launch(
      runEffect(
        Effect.gen(function* () {
          const service = yield* TodoService;
          yield* service.setCompleted(todo.id, !todo.completed);
          return !todo.completed;
        }),
        (completed) => {
          setTodos((current) =>
            current.map((item) => (item.id === todo.id ? { ...item, completed } : item)),
          );
          setError(null);
          reloadTasksWidget();
        },
      ),
    );
  };

  const remove = (todo: Todo) => {
    setError(null);
    launch(
      runEffect(
        Effect.gen(function* () {
          const service = yield* TodoService;
          yield* service.remove(todo.id);
          return todo.id;
        }),
        (id) => {
          setTodos((current) => current.filter((item) => item.id !== id));
          setError(null);
          reloadTasksWidget();
        },
      ),
    );
  };

  const beginEdit = useCallback((todo: Todo) => {
    setEditing(todo);
    setTitle(todo.title);
  }, []);

  useEffect(() => {
    if (!authenticated || !pendingTodoID) return;
    const linkedTodoID = pendingTodoID;
    setPendingTodoID(null);
    setPendingCreate(false);
    setLoading(true);
    launch(
      runEffect(
        Effect.gen(function* () {
          const service = yield* TodoService;
          return yield* service.list();
        }),
        (items) => {
          setTodos(items);
          setError(null);
          setLoading(false);
          const linkedTodo = items.find((todo) => todo.id === linkedTodoID);
          if (linkedTodo) beginEdit(linkedTodo);
          else setError("That task could not be found.");
        },
        () => setLoading(false),
      ),
    );
  }, [authenticated, beginEdit, pendingTodoID, runEffect]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>DOIT · MAC</Text>
        {authLoading ? (
          <ActivityIndicator color="#6f63e8" style={styles.loader} />
        ) : !authenticated ? (
          <View style={styles.authPanel}>
            <Text style={styles.heading}>Sign in to Doit</Text>
            <Text style={styles.subtitle}>
              Continue in your browser to sign in or create an account with a passkey or email and
              password. You’ll return here when finished.
            </Text>
            {error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={authBusy}
              onPress={openBrowserAuth}
              style={[styles.primaryButton, authBusy && styles.disabled]}
            >
              <Text style={styles.primaryButtonText}>Continue in browser</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.heading}>Your todos</Text>
            <Text style={styles.subtitle}>Synced with your Doit web app.</Text>
            <Pressable
              accessibilityRole="button"
              disabled={authBusy}
              onPress={signOut}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Sign out</Text>
            </Pressable>

            <View style={styles.composer}>
              <TextInput
                accessibilityLabel={editing ? "Edit todo title" : "New todo title"}
                maxLength={240}
                onChangeText={setTitle}
                onSubmitEditing={submit}
                placeholder="What needs doing?"
                placeholderTextColor="#85858f"
                ref={titleInputRef}
                returnKeyType="done"
                style={styles.input}
                value={title}
              />
              <Pressable
                accessibilityRole="button"
                disabled={!title.trim()}
                onPress={submit}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                  !title.trim() && styles.disabled,
                ]}
              >
                <Text style={styles.primaryButtonText}>{editing ? "Save" : "Add"}</Text>
              </Pressable>
              {editing && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setEditing(null);
                    setTitle("");
                  }}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
              )}
            </View>

            {error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}

            {loading ? (
              <ActivityIndicator color="#6f63e8" style={styles.loader} />
            ) : (
              <FlatList
                contentContainerStyle={styles.list}
                data={todos}
                keyExtractor={(todo) => todo.id}
                ListEmptyComponent={
                  <Text style={styles.empty}>You’re all caught up. Add a todo above.</Text>
                }
                renderItem={({ item }) => (
                  <View style={styles.todoRow}>
                    <Pressable
                      accessibilityLabel={
                        item.completed
                          ? `Mark ${item.title} as not done`
                          : `Mark ${item.title} as done`
                      }
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: item.completed }}
                      onPress={() => toggle(item)}
                      style={[styles.check, item.completed && styles.checked]}
                    >
                      {item.completed && <Text style={styles.checkmark}>✓</Text>}
                    </Pressable>
                    <Text
                      numberOfLines={2}
                      style={[styles.todoTitle, item.completed && styles.completedTitle]}
                    >
                      {item.title}
                    </Text>
                    <Pressable
                      accessibilityLabel={`Edit ${item.title}`}
                      onPress={() => beginEdit(item)}
                      style={styles.rowAction}
                    >
                      <Text style={styles.rowActionText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`Delete ${item.title}`}
                      onPress={() => remove(item)}
                      style={styles.rowAction}
                    >
                      <Text style={styles.deleteText}>Delete</Text>
                    </Pressable>
                  </View>
                )}
              />
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5f5f8" },
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
    paddingHorizontal: 36,
    paddingTop: 42,
  },
  authPanel: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    gap: 12,
    marginTop: 36,
  },
  eyebrow: {
    color: "#6f63e8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  heading: { marginTop: 10, color: "#1e1d26", fontSize: 34, fontWeight: "700" },
  subtitle: { marginTop: 7, color: "#70707c", fontSize: 15 },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 28,
  },
  input: {
    flex: 1,
    minWidth: 100,
    height: 46,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#d6d5df",
    borderRadius: 10,
    backgroundColor: "#fff",
    color: "#1e1d26",
    fontSize: 15,
  },
  primaryButton: {
    height: 46,
    minWidth: 74,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: "#6f63e8",
  },
  primaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  cancelButton: { paddingHorizontal: 6, paddingVertical: 12 },
  cancelButtonText: { color: "#5c5b68", fontSize: 14 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
  error: { marginTop: 14, color: "#b42318", fontSize: 14 },
  loader: { marginTop: 36 },
  list: { paddingTop: 22, paddingBottom: 36 },
  empty: {
    paddingVertical: 20,
    color: "#777683",
    textAlign: "center",
    fontSize: 14,
  },
  todoRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#dedde5",
  },
  check: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#aaa8b5",
    borderRadius: 7,
  },
  checked: { borderColor: "#6f63e8", backgroundColor: "#6f63e8" },
  checkmark: { color: "#fff", fontSize: 14, fontWeight: "700" },
  todoTitle: { flex: 1, color: "#2b2a34", fontSize: 15 },
  completedTitle: { color: "#8c8b96", textDecorationLine: "line-through" },
  rowAction: { paddingHorizontal: 5, paddingVertical: 8 },
  rowActionText: { color: "#5b54c7", fontSize: 13, fontWeight: "600" },
  deleteText: { color: "#a23f46", fontSize: 13, fontWeight: "600" },
});

export default App;
