import { drizzle } from "drizzle-orm/libsql";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey as passkeyPlugin } from "@better-auth/passkey";
import { schema } from "./db-schema";

export type AuthEnv = {
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
};

export function createAuth(env: AuthEnv) {
  if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN || !env.BETTER_AUTH_SECRET) {
    throw new Error("Authentication database or secret is not configured.");
  }
  const db = drizzle({
    connection: { url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN },
    schema,
  });
  const baseURL = env.BETTER_AUTH_URL ?? "https://doit.osbyrne.workers.dev";
  return betterAuth({
    appName: "Doit",
    baseURL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [baseURL],
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    emailAndPassword: { enabled: true },
    plugins: [
      bearer(),
      passkeyPlugin({
        rpID: new URL(baseURL).hostname,
        rpName: "Doit",
        origin: baseURL,
      }),
    ],
  });
}
