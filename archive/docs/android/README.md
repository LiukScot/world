# Android conversion — design docs

This folder collects the analysis behind bringing World to Android.
No code yet. The goal of these docs is to make the eventual decision
explicit and reviewable.

## Contents

| File | Purpose |
|------|---------|
| [`01-approaches.md`](./01-approaches.md) | Five candidate approaches, side-by-side comparison |
| [`02-monorepo-layout.md`](./02-monorepo-layout.md) | How the Android subproject fits into this repo |
| [`03-decision.md`](./03-decision.md) | Criteria that will pick the approach + current standing |

## TL;DR

- The web app (`backend/` + `frontend/`) stays as is.
- The Android client will reuse the backend over HTTP; UI is the only
  thing being rebuilt or wrapped.
- Five paths considered: TWA, Capacitor, React Native, Compose
  Multiplatform, native Kotlin/Compose.
- Default leaning: **native Kotlin/Compose**, because the project is
  also a learning vehicle for Android and the team is one person.
  Capacitor is the fast-ship alternative if priorities shift to
  time-to-store.
- Monorepo, not split repos. New top-level dirs: `android/` and
  `shared/`.

Read `03-decision.md` for the criteria and `01-approaches.md` for the
trade-off matrix.
