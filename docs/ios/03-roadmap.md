# iOS migration — roadmap

Each phase ends with a check that passes or fails. Estimates assume
one person part-time and are rough.

## Phase 0 — spikes (about 1 day)

Throwaway code. Each answers one question the design depends on.

- [ ] **Signer.** Build an unsigned IPA of an empty Capacitor app in
      CI, sign it with the chosen signer, install it.
      Check: the app opens on the phone.
- [x] **Linux project generation.** Run `npx cap add ios` and
      `npx cap sync ios` on Linux, then build that `ios/` in CI.
      Check: the archive step succeeds. Passed with Capacitor 8.5.2.
- [ ] **sql.js and the schema.** Run `runMigrations` against sql.js.
      Check: it completes, FTS5 tables included.
- [ ] **File persistence.** Export the sql.js database, write it with
      the Filesystem plugin, kill the app, reopen.
      Check: the data is still there.
- [ ] **Database size.** Read the size of the server's `world.sqlite`.
      Check: a full write takes under ~100 ms on the phone.

A failed spike changes the design before any real code is written.

## Phase 1 — backend runs outside Bun (2–3 days)

- [ ] Split `app.ts` into shared API, server entry and app entry.
- [ ] Add the raw-SQLite adapter used by `db.ts` and
      `money-backup-helpers.ts`.
- [ ] Keep `env.ts`, `node:fs`, `Bun.*` out of the shared part.

Check: the existing backend and e2e suites pass unchanged on the
server build, and the shared API bundles for a browser target.

## Phase 2 — app build in the browser (3–5 days)

- [ ] Add the app entry: sql.js, local-user middleware, no auth routes.
- [ ] Give the five `fetch` call sites a transport.
- [ ] Persist the database (IndexedDB in the browser, behind the same
      interface the Filesystem plugin will implement).
- [ ] Add a second Vite build target for the app.

Check: the app build opens in desktop Chromium with no backend
process running, an entry survives a reload, and a Playwright smoke
test covers it in CI.

## Phase 3 — on the phone (1–2 days)

- [ ] Add Capacitor, commit `ios/`.
- [ ] Add the CI workflow that uploads the unsigned IPA.
- [ ] Persist to `Library/world.sqlite` through the Filesystem plugin.
- [ ] Bundle the font, add safe-area padding and the `<meta>` CSP.

Check: the signed app works in airplane mode and keeps its data
after a restart.

## Phase 4 — data and backup (about 2 days)

- [ ] Replace the three blob downloads with file + share sheet.
- [ ] Import the server's JSON export for both realms.
- [ ] Document install, update and backup in the root `README.md`.

Check: an export made on the phone restores into a fresh install with
the same entry counts.

The server copy stays the source of truth until this check passes.

## Phase 5 — reminders and lock (about 2 days)

- [ ] Local notification reminders, configurable in Settings.
- [ ] Optional Face ID lock on app open.

Check: a reminder fires with the app closed; the lock blocks the UI
until Face ID succeeds.

## Phase 6 — HealthKit (2–3 days)

- [ ] Repeat the signer spike with the HealthKit entitlement.
- [ ] Read the chosen data types through the health plugin.

Check: the app shows a value read from the Health app.

## Phase 7 — widget (blocked)

Blocked until the signing service provides a profile for the
extension's bundle identifier. It is the only item that needs
hand-written Swift.

## Open questions

- Can the signing service issue a second profile for an app
  extension? Without it there is no widget.
- Does the server build remain a supported target after phase 4, or
  is it removed?
- Which HealthKit data is wanted, and is it read, written, or both?
- What should the widget show?
- Should the app update itself, or is reinstalling a new IPA from the
  CI artifact acceptable?
