# iOS migration — architecture

## Today

```
browser ──HTTP──> Bun.serve ──> Hono app ──> Drizzle ──> bun:sqlite ──> data/world.sqlite
                  (server)
```

## Target

```
┌──────────────── iOS app (Capacitor) ────────────────┐
│ WKWebView                                           │
│   React frontend                                    │
│     └─ apiFetch ──function call──> Hono app.fetch   │
│                                      └─ Drizzle     │
│                                          └─ sql.js  │
│                                              │      │
│ Capacitor plugins <──────────────────────────┘      │
│   Filesystem  → Library/world.sqlite                │
│   Share, LocalNotifications, Biometric, Health      │
└─────────────────────────────────────────────────────┘
```

Nothing listens on a port. The backend is a library the frontend
imports.

## What is reused, what changes

Measured on `main`: `backend/src` is 4,947 lines without tests,
`frontend/src` 11,177.

| Piece | Reuse | Change |
|-------|-------|--------|
| Routes, zod schemas, helpers | as is | none |
| Drizzle schema and queries | as is | driver import only |
| `backend/src/db.ts` migrations | logic as is | raw calls go through a small adapter (see below) |
| `backend/src/app.ts` | API part | static file serving, dev proxy and `node:fs` move to the server entry |
| `backend/src/routes/auth.ts` | server only | not mounted in the app |
| `frontend/src` | as is | 5 `fetch` call sites, 3 file downloads, fonts |

## Backend inside the WebView

Hono is built on the web `Request`/`Response` API and runs in a
browser. `app.fetch(request)` is a plain function call.

A service worker would intercept `fetch` with no frontend change, but
WKWebView runs service workers only on App-Bound Domains, so the
frontend calls the app directly.

The frontend has one helper, `apiFetch` in `frontend/src/lib.ts`, plus
four direct `fetch` calls in `use-settings.ts` and
`use-money-settings.ts`. All five take a transport: `fetch` on the
web build, `app.fetch` on the app build.

### Split `app.ts`

`app.ts` opens the database, builds the API and serves static files
in one module. It becomes:

- a function that takes a database and returns the Hono API (shared);
- the server entry: opens `bun:sqlite`, adds static serving, CORS,
  security headers, rate limiting, `Bun.serve`;
- the app entry: opens sql.js, adds the local-user middleware.

`env.ts` reads `process.env` and `node:path` at import time. The
shared part must not import it; the values it needs
(session TTL, cookie name) are server-only.

## Database

### Why sql.js

Every query in the backend is synchronous: `.get()`, `.run()`,
`.all()`, `db.transaction(() => …)`. The driver decides how much of
the backend is rewritten.

| Option | API | Storage | Cost |
|--------|-----|---------|------|
| **sql.js** + `drizzle-orm/sql-js` | sync | in memory, saved to a file by us | driver import + adapter |
| Native plugin + `drizzle-orm/sqlite-proxy` | async | real SQLite file | every query site becomes `await`; sync transactions rewritten |
| Official SQLite WASM + OPFS | async (worker) | WebKit storage | as above; OPFS under `capacitor://` unconfirmed |

sql.js also runs in desktop Chromium, so the app build can be
developed and tested on Linux with Playwright. A native plugin runs
only on a device.

### Persistence

sql.js keeps the database in memory. After each request that writes,
the app exports the database bytes and writes them to
`Library/world.sqlite` through the Filesystem plugin, and answers the
request only after the write finishes.

The file is written whole. `Library/` is included in device backups
and is not subject to WebKit storage eviction, unlike IndexedDB.

Known ceiling: write cost grows with database size. The server
database is the reference; measure it before phase 2. If it reaches
tens of megabytes, move to the native plugin and accept the async
rewrite.

### Raw SQLite calls

`db.ts` and `money-backup-helpers.ts` call the `bun:sqlite` API
directly (`db.query(sql).get()`, `db.exec`, `db.transaction`). sql.js
names these differently. One adapter with those three methods, with a
`bun:sqlite` and a sql.js implementation, keeps both callers
unchanged.

### FTS5

The default sql.js build does not include FTS5, SQLite's full-text
search module. The schema no longer needs it: the four full-text
indexes were unused and are dropped by the migration at schema
version 19.

One limit remains. A database file created before version 19 still
contains the indexes, and SQLite cannot drop an FTS5 table without the
FTS5 module. sql.js therefore cannot open a server `world.sqlite`
directly. Data moves to the app through the JSON export, described
below.

## Authentication

The server uses a session cookie and argon2id through `Bun.password`.
Neither carries over:

- `Set-Cookie` is a forbidden header on a `Response` built in
  JavaScript, so the cookie never reaches the WebView.
- `Bun.password` does not exist outside Bun.

In the app there is one user and one device. A middleware replaces
`requireAuth` and sets the single local user on every request. The
login screen is not shown. The phone's passcode and iOS file
encryption protect the data at rest; an optional Face ID lock on app
open adds a second gate (see `02-build-and-signing.md`).

The server keeps its login unchanged.

## Frontend changes

- **Transport**: the five `fetch` call sites described above.
- **Downloads**: the three backup exports build a blob and click an
  `<a download>`. WKWebView ignores that. In the app they write the
  file with the Filesystem plugin and open the share sheet.
- **Fonts**: `index.html` loads Manrope from Google Fonts. Offline
  this fails. The font files are bundled in `frontend/public/`.
- **Safe areas**: notch and home indicator need
  `viewport-fit=cover` and `env(safe-area-inset-*)` padding.
- **Security headers**: the CSP set in `app.ts` is an HTTP header and
  does not exist in the app. An equivalent `<meta>` CSP goes in the
  app build's `index.html`.

## Moving the existing data

Settings → Backup already exports and imports JSON for both realms
(`/api/v1/backup/json`, `/api/v1/money/backup/json`). Export on the
server, import in the app. No new code.

## Backup once the data is on the phone

The phone holds the only copy. Three layers:

1. Device backup (iCloud or computer) includes `Library/`.
2. The in-app JSON and Excel export, through the share sheet.
3. Optional: `UIFileSharingEnabled` in `Info.plist` and the database
   in `Documents/` make the file visible in the Files app.

Layer 2 must work before the server copy is retired.
