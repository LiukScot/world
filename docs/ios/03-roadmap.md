# iOS migration — roadmap

Each phase ends with a check that passes or fails.

## Phase 0 — spikes

Throwaway code. Each answers one question the design depends on.

- [x] **Signer.** Build an unsigned IPA of an empty Capacitor app in
      CI, sign it with the chosen signer, install it.
      Check: the app opens on the phone. Passed. The page title sat
      under the status bar, which confirms the safe-area work in
      phase 3.
- [x] **Linux project generation.** Run `npx cap add ios` and
      `npx cap sync ios` on Linux, then build that `ios/` in CI.
      Check: the archive step succeeds. Passed with Capacitor 8.5.2.
- [x] **sql.js and the schema.** Run the schema statements against
      sql.js. Check: they all complete. Passed with sql.js on SQLite
      3.49.1, after the unused FTS5 indexes were removed from the
      schema.
- [x] **File persistence.** Export the sql.js database, write it with
      the Filesystem plugin, kill the app, reopen.
      Check: the data is still there. Passed: a 5.9 MB database was
      read back from `Library/` after the app was closed.
- [x] **Database size.** Measure a full write on the phone.
      Check: under ~100 ms at the size World will reach. Passed: about
      120 ms at 5.9 MB and 200 ms at 11.7 MB, roughly 17–20 ms per
      megabyte; the export itself takes 1–6 ms. The development
      database is 0.2 MB. The size of the server database is not read
      yet.

A failed spike changes the design before any real code is written.

## Phase 1 — backend runs outside Bun

- [x] Move the data routes into `api.ts`, which imports nothing from
      Bun or Node. `app.ts` stays the server entry.
- [x] Move `openDb` and `createDrizzle` into `open-db.ts`, the only
      module that imports `bun:sqlite` at run time.
- [x] Make `env.ts` load where `process` does not exist.
- [x] Add a test that bundles `api.ts` for a browser.

Check: the existing backend and e2e suites pass unchanged on the
server build, and the shared API bundles for a browser target. Passed.

## Phase 2 — app build in the browser

- [x] Add `backend/src/local-app.ts`: sql.js, one local user, no auth
      routes. An adapter gives sql.js the part of the `bun:sqlite` API
      that `db.ts` and the backup routes call.
- [x] Route the five `fetch` call sites through `frontend/src/transport.ts`.
- [x] Persist the database after every request that changes it.
- [x] Add the build target: `vite build`, output in
      `frontend/dist/`.

Check: the device build opens in desktop Chromium with no backend
process running, an entry survives a reload, and a Playwright test
covers it in CI. Passed (`tests/device.spec.ts`).

## Phase 3 — on the phone

- [x] Add Capacitor, commit `ios/`.
- [x] Add the CI workflow that uploads the unsigned IPA
      (`.github/workflows/ios.yml`).
- [x] Persist to `Library/world.sqlite` through the Filesystem plugin.
- [x] Bundle the font and add the `<meta>` CSP.
- [x] Add safe-area padding, checked against a screenshot from the
      phone.

Check: the signed app works in airplane mode and keeps its data
after a restart.

## Phase 4 — data and backup

Tracked in #242.

- [x] Replace the four blob downloads with file + share sheet
      (`frontend/src/save-file.ts`).
- [x] Import the server's JSON export for both realms. The Health
      export now also carries CBT, DBT and memorable days; a backup
      without those sections leaves them untouched.
- [x] Document install, update and backup in the root `README.md`.

Check: an export made on the phone restores into a fresh install with
the same entry counts.

The server copy stays the source of truth until this check passes.

## Phase 5 — reminders and lock

Tracked in #243.

- [ ] Local notification reminders, configurable in Settings.
- [ ] Optional Face ID lock on app open.

Check: a reminder fires with the app closed; the lock blocks the UI
until Face ID succeeds.

## Phase 6 — HealthKit

Tracked in #244.

- [ ] Repeat the signer spike with the HealthKit entitlement.
- [ ] Read the chosen data types through the health plugin.

Check: the app shows a value read from the Health app.

## Phase 7 — widget (blocked)

Tracked in #245.

Blocked until the signing service provides a profile for the
extension's bundle identifier. It is the only item that needs
hand-written Swift.

## Open questions

- Can the signing service issue a second profile for an app
  extension? Without it there is no widget.
- Which HealthKit data is wanted, and is it read, written, or both?
- What should the widget show?
- Should the app update itself, or is reinstalling a new IPA from the
  CI artifact acceptable?
