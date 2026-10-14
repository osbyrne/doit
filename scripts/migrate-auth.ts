import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) throw new Error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before migrating.");
const db = createClient({ url, authToken });
try {
  const todoColumns = await db.execute("PRAGMA table_info(todos)");
  if (todoColumns.rows.some((row) => row.name === "user_id")) {
    console.log("Turso auth and user-scoped todo tables are already ready.");
    process.exit(0);
  }
  await db.executeMultiple(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      emailVerified INTEGER NOT NULL DEFAULT 0, image TEXT,
      createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY NOT NULL, expiresAt INTEGER NOT NULL, token TEXT NOT NULL UNIQUE,
      createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, ipAddress TEXT, userAgent TEXT,
      userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY NOT NULL, accountId TEXT NOT NULL, providerId TEXT NOT NULL,
      userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, accessToken TEXT,
      refreshToken TEXT, idToken TEXT, accessTokenExpiresAt INTEGER, refreshTokenExpiresAt INTEGER,
      scope TEXT, password TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY NOT NULL, identifier TEXT NOT NULL, value TEXT NOT NULL,
      expiresAt INTEGER NOT NULL, createdAt INTEGER, updatedAt INTEGER
    );
    CREATE TABLE IF NOT EXISTS passkey (
      id TEXT PRIMARY KEY NOT NULL, name TEXT, publicKey TEXT NOT NULL,
      userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, credentialID TEXT NOT NULL UNIQUE,
      counter INTEGER NOT NULL, deviceType TEXT NOT NULL, backedUp INTEGER NOT NULL,
      transports TEXT, createdAt INTEGER, aaguid TEXT
    );
    ALTER TABLE todos RENAME TO todos_unauthenticated;
    CREATE TABLE todos (
      id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      title TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
    DROP TABLE todos_unauthenticated;
  `);
  console.log("Turso auth and user-scoped todo tables are ready.");
} finally {
  db.close();
}
