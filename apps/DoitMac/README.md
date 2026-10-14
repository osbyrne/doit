# Doit for macOS

This folder contains the React Native macOS companion app and its WidgetKit
Control Center extension. The app uses the deployed Doit Worker API at
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
project.

## Run the app on a Mac

Use the same minor version of React Native and React Native macOS (currently
0.83). From this directory:

```sh
bun install
cd macos && pod install && cd ..
bun run start
```

In a second terminal, run:

```sh
cd apps/DoitMac
bun run macos
```

Opening `macos/com.osbyrne.doit.xcodeproj` in Xcode and running the
`com.osbyrne.doit-macOS` scheme also builds and embeds the `DoitControl`
extension. The first build may require choosing a signing team in Xcode.

## Add the Control Center control

On macOS 15 or later, open Control Center, choose **Edit Controls**, search
for **Complete next todo**, and add it. Activating the control marks the
oldest incomplete todo as complete. The extension currently does not share the
app's bearer session, so authenticated API access from the control requires a
shared credential bridge before it will work.

## Build limitation

React Native macOS and the WidgetKit extension require Xcode, the macOS SDK,
and Apple signing tools. This repository was authored on Linux, so the native
targets cannot be compiled or signed here. Open the Xcode project on a Mac to
finish those platform-specific checks.
