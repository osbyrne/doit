import { fileRoutes } from "filesystem-routing/vite";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import solid from "@solidjs/vite-plugin";

function todosApi() {
  return {
    name: "doit-todos-api",
    configureServer(server: import("vite").ViteDevServer) {
      const env = loadEnv(server.config.mode, server.config.root, "");
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (!url.pathname.startsWith("/api/todos") && !url.pathname.startsWith("/api/auth/")) return next();
        const chunks: Uint8Array[] = [];
        req.on("data", (chunk: Uint8Array) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            const body = chunks.length ? Buffer.concat(chunks).toString() : undefined;
            const request = new Request(`http://localhost${url.pathname}${url.search}`, {
              method: req.method,
              headers: req.headers as HeadersInit,
              body: ["GET", "HEAD"].includes(req.method ?? "GET") ? undefined : body,
            });
            const response = url.pathname.startsWith("/api/auth/")
              ? await (await server.ssrLoadModule("/src/server/auth.ts")).createAuth({
                  ...env,
                  BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
                  BETTER_AUTH_URL: "http://localhost:3000",
                }).handler(request)
              : await (await server.ssrLoadModule("/src/server/todos.ts")).handleTodosRequest(request, {
                  ...env,
                  BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
                  BETTER_AUTH_URL: "http://localhost:3000",
                });
            res.statusCode = response.status;
            response.headers.forEach((value: string, key: string) => res.setHeader(key, value));
            res.end(await response.text());
          } catch (error) {
            next(error);
          }
        });
      });
    },
  };
}

export default defineConfig({
  // Turnkey client mode: no index.html and no mount file — the plugin generates
  // the entries around src/App.tsx (wrapped in src/Document.tsx) and `vite build`
  // prerenders the shell into a purely static dist/client.
  plugins: [
    // `extensions` makes @solidjs/vite-plugin also compile the `?pick=` route
    // modules the fileRoutes plugin emits (their ids end in a query string).
    solid({ start: true, extensions: [".jsx", ".tsx", ".tsrx"], diagnostics: true }), // add `ssr: true` for streaming SSR
    // Route modules are .tsrx: fileRoutes' export analyzer parses them through
    // @tsrx/oxc (an optional peer of filesystem-routing, installed here).
    fileRoutes({ types: true }),
    todosApi(),
  ],
  server: {
    port: 3000,
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./vitest-setup.ts"],
    // if you have few tests, try commenting this
    // out to improve performance:
    isolate: false,
  },
  build: {
    target: "esnext",
    assetsInlineLimit: 0,
  },
});
