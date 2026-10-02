# iOS migration — design docs

World becomes an iOS app that holds its own data and needs no server.
No code yet. These docs record the design, what is verified, and what
must be proven before building.

## Contents

| File | Purpose |
|------|---------|
| [`01-architecture.md`](./01-architecture.md) | How backend, database and frontend run inside the app |
| [`02-build-and-signing.md`](./02-build-and-signing.md) | Building without a Mac, signing, debugging, native features |
| [`03-roadmap.md`](./03-roadmap.md) | Phases, each with its check, and the open questions |

## Constraints

- No Mac. Development happens on Linux; Xcode runs only in CI.
- As little hand-written Swift as possible.
- Data lives on the phone. The app works with no network.
- No Apple Developer Program build pipeline: CI produces an unsigned
  `.ipa`, signed afterwards with a third-party app signer.

## TL;DR

- **Shell**: [Capacitor](https://capacitorjs.com/) 8. It wraps
  `frontend/` in a WebView and generates the Xcode project, including
  the Swift entry point. Native APIs come from plugins called from
  TypeScript.
- **Backend**: the existing Hono app runs inside the WebView. The
  frontend calls `app.fetch(request)` as a function instead of sending
  an HTTP request. Routes, validation and Drizzle queries are reused.
- **Database**: SQLite compiled to WebAssembly (sql.js), saved as a
  file in the app container. Chosen because its API is synchronous
  like `bun:sqlite`, so the ~107 query call sites stay unchanged.
- **Login**: removed in the app. There is one user and the phone's
  lock screen protects the data; Face ID lock is an optional plugin.
- **Swift written by hand**: none for the app, notifications, Face ID,
  backup and HealthKit. A home-screen widget is the exception: it is a
  SwiftUI extension by Apple's design, and it is the part most likely
  to break under third-party signing.
- **Server build**: stays working. It is the source of the data to
  import and it shares the backend code, so it costs nothing to keep.

## Relation to `docs/android/`

`docs/android/03-decision.md` leans to native Kotlin and asks to
reconsider if iOS lands first. Capacitor also targets Android: the
same `frontend/` and in-WebView backend would build an APK. That
decision is not revisited here.
