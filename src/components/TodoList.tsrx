import { createSignal } from "solid-js";
import type { Todo } from "../server/todos";

export default function TodoList() @{
  const [todos, setTodos] = createSignal<Todo[]>([]);
  const [title, setTitle] = createSignal("");
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editingTitle, setEditingTitle] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");

  const request = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, init);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Something went wrong.");
    return data;
  };

  const load = async () => {
    try {
      const data = await request("/api/todos");
      setTodos(data.todos);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load todos.");
    }
  };

  void load();

  const addTodo = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!title().trim() || busy()) return;
    setBusy(true);
    try {
      const data = await request("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title() }),
      });
      setTodos([data.todo, ...todos()]);
      setTitle("");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add todo.");
    } finally {
      setBusy(false);
    }
  };

  const toggleTodo = async (todo: Todo) => {
    try {
      await request(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !todo.completed }),
      });
      setTodos(todos().map((item) => item.id === todo.id ? { ...item, completed: !item.completed } : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update todo.");
    }
  };

  const saveEdit = async (event: SubmitEvent, todo: Todo) => {
    event.preventDefault();
    const nextTitle = editingTitle().trim();
    if (!nextTitle) return;
    try {
      await request(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });
      setTodos(todos().map((item) => item.id === todo.id ? { ...item, title: nextTitle } : item));
      setEditingId(null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not edit todo.");
    }
  };

  const removeTodo = async (todo: Todo) => {
    try {
      await request(`/api/todos/${todo.id}`, { method: "DELETE" });
      setTodos(todos().filter((item) => item.id !== todo.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete todo.");
    }
  };

  <section class="todos" aria-labelledby="todos-title">
    <h2 id="todos-title">Your todos</h2>
    <form onSubmit={addTodo}>
      <label class="sr-only" for="todo-title">New todo</label>
      <input
        id="todo-title"
        maxlength="240"
        onInput={(event) => setTitle(event.currentTarget.value)}
        placeholder="What needs doing?"
        value={title()}
      />
      <button disabled={busy() || !title().trim()} type="submit">Add todo</button>
    </form>
    @if (error()) {
      <p class="error" role="alert">{error()}</p>;
    }
    <ul>
      @for (const todo of todos()) {
        <li>
          @if (editingId() === todo.id) {
            <form class="edit-form" onSubmit={(event) => void saveEdit(event, todo)}>
              <label class="sr-only" for={`edit-${todo.id}`}>Edit todo</label>
              <input
                id={`edit-${todo.id}`}
                maxlength="240"
                onInput={(event) => setEditingTitle(event.currentTarget.value)}
                value={editingTitle()}
              />
              <button disabled={!editingTitle().trim()} type="submit">Save</button>
              <button onClick={() => setEditingId(null)} type="button">Cancel</button>
            </form>;
          } @else {
            <label classList={{ completed: todo.completed }}>
              <input checked={todo.completed} onChange={() => void toggleTodo(todo)} type="checkbox" />
              <span>{todo.title}</span>
            </label>;
          }
          <div class="todo-actions">
            @if (editingId() !== todo.id) {
              <button onClick={() => { setEditingId(todo.id); setEditingTitle(todo.title); }} type="button">Edit</button>;
            }
            <button aria-label={`Delete ${todo.title}`} onClick={() => void removeTodo(todo)} type="button">Delete</button>
          </div>
        </li>;
      } @empty {
        <li class="empty">No todos yet. Add one above.</li>;
      }
    </ul>
  </section>;
}
