# Doit for macOS

This folder contains the React Native macOS companion app, a WidgetKit task
widget, a menu-bar task list, and a WidgetKit Control Center control. The app
uses the deployed Doit Worker API at
`https://doit.osbyrne.workers.dev/api/todos` with a Better Auth bearer session.
The app opens the system browser for sign-in and account creation, so both
passkey and email/password flows use the web origin's WebAuthn support. After
authentication, the browser returns to the app through the
`com.osbyrne.doit://auth` URL scheme. The macOS app registers that scheme in its
Info.plist; Android registers it as a browsable intent filter.

The web sign-up screen supports creating a passkey-first account with an email
address and optional name. The Worker issues an encrypted, short-lived
registration context and only creates the account after WebAuthn registration
verifies. Email ownership is not verified because this deployment does not yet
have an email delivery/verification provider configured.

## Effect v4 architecture

The app's auth and todo I/O lives under `src/effect`. `AuthService` and
`TodoService` expose typed Effects; `TodoServiceLive` is built with the auth
service it needs, and `AppServicesLive` composes them into a managed runtime.
Network todo payloads are decoded with Effect Schema before they enter UI
state. Expected failures use tagged errors, so auth, validation, HTTP, malformed
responses, and transport failures stay distinguishable. The React component
owns the runtime lifetime, interrupts running Effects on unmount, and forwards
cancellation signals to signal-aware requests. A mounted guard prevents
late-running SDK promises from changing UI state after unmount. Failed Exits
are translated into user-facing messages.

Run `bun run typecheck` from this directory to check the native app's TypeScript
project. The repo-root Flox environment pins Bun and Node; this app's
`package.json` and `bun.lock` pin React Native and its transitive dependencies.

## Run the app on a Mac

Use the repo's Flox environment from the repository root. It pins Bun 1.4.2
and Node 22.21.1; this app pins React Native 0.83.10 and React Native macOS
0.83.0. From the activated shell:

```sh
cd apps/DoitMac
bun install --frozen-lockfile
cd macos && pod install && cd ..
bun run start
```

In a second terminal opened at the repository root, activate Flox and run:

```sh
flox activate
cd apps/DoitMac
bun run macos
```

Opening `macos/com.osbyrne.doit.xcodeproj` in Xcode and running the
`com.osbyrne.doit-macOS` scheme also builds and embeds the `DoitControl`
extension. The first build may require choosing a signing team in Xcode.

## Tasks from macOS

The menu-bar item **Doit** opens a scrollable list of all tasks. Use the circle
to mark a task done, or select the pencil to edit a title inline. The **Open
Doit** link opens the main app.
The standard **Doit Tasks** widget lists the first four open tasks in medium
size and first seven in large size. Use the circle to complete a task, the
trash button to delete it, or the title to open it in Doit for editing. The
plus button opens the app with the new-task field focused. Add the widget to
the desktop or Notification Center from the macOS widget gallery.

The Control Center control is an **Open Doit tasks** shortcut. WidgetKit's
ControlWidget API only supports compact controls such as buttons and toggles;
it does not allow a scrollable task list in Control Center. The shortcut opens
the app, where the complete task list is scrollable.

On macOS 26 or later, open Control Center, choose **Edit Controls**, and add
**Open Doit tasks**. Add **Doit Tasks** separately from the desktop or
Notification Center widget gallery.

The app and extension share the Better Auth bearer token through the
`group.com.osbyrne.doit` App Group. Register that App Group for the signing team
in Xcode's Developer account, and keep the matching App Group capability in
both app and extension entitlements. The extension requires macOS 26 or later.

## Build limitation

React Native macOS and the WidgetKit extension require Xcode, the macOS SDK,
and Apple signing tools. This repository was authored on Linux, so the native
targets cannot be compiled or signed here. Open the Xcode project on a Mac to
finish those platform-specific checks.
