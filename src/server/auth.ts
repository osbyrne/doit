import { drizzle } from "drizzle-orm/libsql";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey as passkeyPlugin } from "@better-auth/passkey";
import { APIError } from "better-auth/api";
import { schema } from "./db-schema";
import { readPasskeySignupContext } from "./passkey-signup";

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
        registration: {
          requireSession: false,
          resolveUser: async ({ ctx, context }) => {
            const details = await readPasskeySignupContext(context, env.BETTER_AUTH_SECRET!);
            const existing = await ctx.context.internalAdapter.findUserByEmail(details.email);
            if (existing) {
              throw APIError.from("BAD_REQUEST", {
                code: "USER_ALREADY_EXISTS",
                message: "An account with this email already exists. Sign in instead.",
              });
            }
            return {
              id: crypto.randomUUID(),
              name: details.email,
              displayName: details.name,
            };
          },
          afterVerification: async ({ ctx, user, context }) => {
            // A missing context means this is an authenticated user adding an
            // extra passkey. Passkey-first signup always carries the encrypted
            // short-lived context issued by the Worker endpoint.
            if (!context) return;
            const details = await readPasskeySignupContext(context, env.BETTER_AUTH_SECRET!);
            const existingId = await ctx.context.internalAdapter.findUserById(user.id);
            if (existingId) {
              throw APIError.from("BAD_REQUEST", {
                code: "ACCOUNT_SESSION_EXISTS",
                message: "Sign out of the current web account before creating another account.",
              });
            }
            const existingEmail = await ctx.context.internalAdapter.findUserByEmail(details.email);
            if (existingEmail) {
              throw APIError.from("BAD_REQUEST", {
                code: "USER_ALREADY_EXISTS",
                message: "An account with this email already exists. Sign in instead.",
              });
            }
            await ctx.context.internalAdapter.createUser(
              {
                id: user.id,
                email: details.email,
                name: details.name,
                emailVerified: false,
              },
              { method: "passkey" },
            );
          },
        },
      }),
    ],
  });
}
