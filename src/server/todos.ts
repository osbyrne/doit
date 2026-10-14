import { eq, and, desc } from "drizzle-orm";
import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import { todos } from "./db-schema";
import { createAuth, type AuthEnv } from "./auth";

export type Todo = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export async function handleTodosRequest(request: Request, env: AuthEnv): Promise<Response> {
  if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
    return json({ error: "Turso is not configured on the server." }, 503);
  }
  let auth;
  try {
    auth = createAuth(env);
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return json({ error: "Sign in to access your todos." }, 401);

    const client = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
    const db = drizzle({ client });
    const { pathname } = new URL(request.url);
    const id = pathname.split("/").filter(Boolean)[2];
    try {
      if (request.method === "GET") {
        const items = await db.select().from(todos).where(eq(todos.userId, session.user.id)).orderBy(desc(todos.createdAt));
        return json({ todos: items });
      }
      if (request.method === "POST") {
        const body = await request.json() as { title?: unknown };
        const title = typeof body.title === "string" ? body.title.trim() : "";
        if (!title) return json({ error: "Enter a todo before adding it." }, 400);
        if (title.length > 240) return json({ error: "Todo titles must be 240 characters or fewer." }, 400);
        const todo = { id: crypto.randomUUID(), userId: session.user.id, title, completed: false, createdAt: new Date().toISOString() };
        await db.insert(todos).values(todo);
        const { userId: _userId, ...publicTodo } = todo;
        return json({ todo: publicTodo }, 201);
      }
      if (!id) return json({ error: "A todo id is required." }, 400);
      if (request.method === "PATCH") {
        const body = await request.json() as { title?: unknown; completed?: unknown };
        const updates: Partial<typeof todos.$inferInsert> = {};
        if (body.title !== undefined) {
          if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 240) {
            return json({ error: "Todo titles must be between 1 and 240 characters." }, 400);
          }
          updates.title = body.title.trim();
        }
        if (body.completed !== undefined) {
          if (typeof body.completed !== "boolean") return json({ error: "Completed must be true or false." }, 400);
          updates.completed = body.completed;
        }
        if (!Object.keys(updates).length) return json({ error: "Provide a title or completed value to update." }, 400);
        const result = await db.update(todos).set(updates).where(and(eq(todos.id, id), eq(todos.userId, session.user.id)));
        if (!result.rowsAffected) return json({ error: "Todo not found." }, 404);
        return json({ ok: true });
      }
      if (request.method === "DELETE") {
        const result = await db.delete(todos).where(and(eq(todos.id, id), eq(todos.userId, session.user.id)));
        if (!result.rowsAffected) return json({ error: "Todo not found." }, 404);
        return json({ ok: true });
      }
      return json({ error: "Method not allowed." }, 405);
    } finally {
      client.close();
    }
  } catch (error) {
    console.error("Turso todo request failed", error);
    return json({ error: "Could not reach the todo database." }, 500);
  }
}
