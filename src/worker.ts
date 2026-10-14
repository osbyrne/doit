import { handleTodosRequest } from "./server/todos";
import { createAuth, type AuthEnv } from "./server/auth";

type WorkerEnv = AuthEnv & {
  ASSETS: { fetch(request: Request): Promise<Response> };
};

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) {
      try {
        return await createAuth(env).handler(request);
      } catch (error) {
        console.error("Better Auth request failed", error);
        return Response.json({ error: "Authentication is not configured." }, { status: 503 });
      }
    }
    if (pathname === "/api/todos" || pathname.startsWith("/api/todos/")) {
      return handleTodosRequest(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
