# Doit

Doit is a todo app with a SolidJS web frontend and a React Native companion for
Android and macOS. The macOS app includes a WidgetKit control for Control
Center.

## Downloads

Native preview builds are published on the [GitHub Releases page](https://github.com/osbyrne/doit/releases):

- **Android:** install the APK on Android 7.0 or later. Preview APKs use the
  repository's development/debug signing key and are not a production or Play
  Store release.
- **macOS:** download and unzip the app bundle. It is not signed with a
  Developer ID certificate or notarized, so Gatekeeper may block the first
  launch. The Control Center extension is included and requires macOS 26 or
  later; its authenticated actions still need a shared-session bridge.

## Live web app and backend

The web app is deployed at <https://doit.osbyrne.workers.dev>. Cloudflare
Workers serves the client and routes authentication and todo API requests to
the Worker. User accounts and todos are stored in Turso through Drizzle ORM;
Better Auth provides email/password and passkey authentication. Todo API
operations require an authenticated session and are scoped to that user.

## Local web development

Install dependencies and copy `.env.example` to `.env`. Set the Turso
credentials and a random `BETTER_AUTH_SECRET`; use a development Turso database
or the values for a database you control.

```sh
bun install
bun run dev
```

Run the database migration once when setting up a new database:

```sh
bun run scripts/migrate-auth.ts
```

Build the web app with `bun run build`. Deployments require the Turso values and
`BETTER_AUTH_SECRET` to be configured as Cloudflare Worker secrets.

## Native app development

The React Native project is in [`apps/DoitMac`](apps/DoitMac/README.md). Android
can be built with the Android SDK. Building the macOS app and Control Center
extension requires a Mac with Xcode. The native app opens the system browser for
authentication and returns to the app through its `com.osbyrne.doit://auth`
URL scheme.

The `v*` tag workflow builds preview APK and macOS app bundle assets and attaches
them to a prerelease. It does not sign the macOS app with a Developer ID or
notarize it. Android preview APKs use the development signing key; production
distribution needs a separately managed signing setup.
