# shared/

Cross-stack assets that need a single source of truth across
`backend/`, `frontend/`, and (future) `android/`.

**Status**: scaffolded, not populated. This directory exists so the
Android exploration documented in [`../docs/android/`](../docs/android/)
has a concrete place to point at when discussing client code
generation.

## What belongs here

- **API contract** (`openapi.yaml` or similar): the spec the backend
  serves and that frontend + Android consume. Hand-written or
  generated from `backend/` route definitions.
- **Generator scripts** (`scripts/`): one per client target
  (TypeScript for `frontend/`, Kotlin/Retrofit for `android/`).
- **Shared docs** about the contract — versioning policy, breaking
  change rules, deprecation flow.

## What does NOT belong here

- Runtime code of any kind. This directory is build-time inputs and
  generated outputs only.
- Per-stack utilities — those live in the respective `backend/src/`,
  `frontend/src/`, `android/app/src/`.
- Secrets, environment files, deploy config.

## Why a shared folder at all

Single source of truth for API shapes means:

- one place to update when an endpoint changes,
- generated clients keep `frontend/` and `android/` in lockstep,
- breaking changes surface at build time in every consumer, not at
  runtime in production.

If only one client ever existed there would be no point. The moment a
second client (the Android app) lands, drift becomes a real risk and
this directory pays for itself.
