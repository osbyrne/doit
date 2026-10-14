const base = "https://doit.osbyrne.workers.dev";
const email = `auth-smoke-${crypto.randomUUID()}@example.com`;
const post = async (path: string, body: unknown, token?: string) => fetch(`${base}${path}`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin: base,
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(body),
});

const unauthenticated = await fetch(`${base}/api/todos`);
if (unauthenticated.status !== 401) throw new Error(`Expected unauthenticated todo API to return 401; received ${unauthenticated.status}.`);

let userId = "";
let todoId = "";
try {
  const registration = await post("/api/auth/sign-up/email", { name: "Smoke Test", email, password: "SmokeTestPass123!" });
  const result = await registration.json() as { user?: { id: string }; message?: string; error?: string };
  if (!registration.ok || !result.user?.id) throw new Error(`Email registration failed (${registration.status}): ${result.message ?? result.error ?? "unknown error"}`);
  userId = result.user.id;
  const token = registration.headers.get("set-auth-token");
  if (!token) throw new Error("Bearer token was not returned after registration.");
  const login = await post("/api/auth/sign-in/email", { email, password: "SmokeTestPass123!" });
  const loginToken = login.headers.get("set-auth-token");
  if (!login.ok || !loginToken) throw new Error(`Email/password sign-in failed (${login.status}).`);

  const created = await post("/api/todos", { title: "Auth smoke todo" }, loginToken);
  const createdBody = await created.json() as { todo?: { id: string } };
  if (created.status !== 201 || !createdBody.todo?.id) throw new Error(`Authenticated todo creation failed (${created.status}).`);
  todoId = createdBody.todo.id;

  const listed = await fetch(`${base}/api/todos`, { headers: { authorization: `Bearer ${loginToken}` } });
  const listedBody = await listed.json() as { todos?: Array<{ id: string; title: string }> };
  if (listed.status !== 200 || !listedBody.todos?.some((todo) => todo.id === todoId)) throw new Error("Authenticated todo listing failed.");

  const edited = await fetch(`${base}/api/todos/${todoId}`, {
    method: "PATCH", headers: { authorization: `Bearer ${loginToken}`, "content-type": "application/json" },
    body: JSON.stringify({ title: "Updated auth smoke todo", completed: true }),
  });
  if (!edited.ok) throw new Error(`Authenticated todo update failed (${edited.status}).`);
  const removed = await fetch(`${base}/api/todos/${todoId}`, { method: "DELETE", headers: { authorization: `Bearer ${loginToken}` } });
  if (!removed.ok) throw new Error(`Authenticated todo deletion failed (${removed.status}).`);
  console.log("PASS: unauthenticated access rejected; email registration and password sign-in issued bearer sessions; authenticated todo create/list/update/delete succeeded.");
} finally {
  if (userId) {
    const { createClient } = await import("@libsql/client");
    const db = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN! });
    try {
      await db.execute({ sql: "DELETE FROM todos WHERE user_id = ?", args: [userId] });
      await db.execute({ sql: "DELETE FROM session WHERE userId = ?", args: [userId] });
      await db.execute({ sql: "DELETE FROM account WHERE userId = ?", args: [userId] });
      await db.execute({ sql: "DELETE FROM passkey WHERE userId = ?", args: [userId] });
      await db.execute({ sql: "DELETE FROM user WHERE id = ?", args: [userId] });
    } finally { db.close(); }
  }
}
