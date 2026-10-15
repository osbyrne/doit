# Doit

Doit is a todo app with a SolidJS web frontend and a React Native companion for
Android and macOS. The macOS app includes a WidgetKit control for Control
Center.

## Live web app and backend

The web app is deployed at <https://doit.osbyrne.workers.dev>. Cloudflare
Workers serves the client and routes authentication and todo API requests to
the Worker. User accounts and todos are stored in Turso through Drizzle ORM;
Better Auth provides email/password and passkey authentication. Todo API
operations require an authenticated session and are scoped to that user.

## Local web development

The repo's [Flox environment](.flox/env/manifest.toml) pins Bun 1.4.2, Node
22.21.1, the Turso CLI 1.0.33, and Cloudflare Wrangler 4.148.0. Its
[lockfile](.flox/env/manifest.lock) records the resolved packages for Apple
Silicon macOS and Linux. Install [Flox](https://flox.dev/docs/install-flox/)
1.17.0, then activate the environment from the repo root before running project
commands:

```sh
flox activate
```

The web and native JavaScript dependency graphs are pinned in `bun.lock` and
`apps/DoitMac/bun.lock`. The native app pins React Native 0.83.10 and React
Native macOS 0.83.0 in its `package.json`.

Copy `.env.example` to `.env`. Set the Turso credentials and a random
`BETTER_AUTH_SECRET`; use a development Turso database or the values for a
database you control. In the activated shell, install dependencies and start
the app:

```sh
bun install --frozen-lockfile
bun run dev
```

Run the database migration once when setting up a new database:

```sh
bun run scripts/migrate-auth.ts
```

Build the web app with `bun run build`. Deploy with `bun run deploy`; the script
uses the Flox-pinned Wrangler. Deployments require the Turso values and
`BETTER_AUTH_SECRET` to be configured as Cloudflare Worker secrets.

## Native app development

The React Native project is in [`apps/DoitMac`](apps/DoitMac/README.md). Android
can be built with the Android SDK. Building the macOS app and Control Center
extension requires a Mac with Xcode. Activate Flox from the repo root before
installing dependencies or running the React Native CLI. The native app opens
the system browser for authentication and returns to the app through its
`com.osbyrne.doit://auth` URL scheme.
