# Android conversion — monorepo layout

Adding Android does not change the repo strategy: **monorepo stays**.
This doc captures the proposed layout and the reasoning, so the
choice is reviewable and reversible.

## Proposed top-level layout

```
world/
├── backend/                Bun + SQLite, unchanged
├── frontend/               React + Vite + shadcn/ui, unchanged
├── android/                NEW — Android client (approach TBD)
├── shared/                 NEW — API contract + codegen scripts
├── docs/
│   ├── android/            this folder
│   └── superpowers/        existing
├── scripts/                existing repo-wide scripts
├── tests/                  Playwright e2e against frontend+backend
├── docker-compose.yml      backend+frontend only
├── package.json            bun workspace root
├── AGENTS.md, CLAUDE.md    cross-cutting rules
└── README.md
```

Only two new top-level directories: `android/` and `shared/`. The
existing tree is untouched.

## Why monorepo (for this project)

- **Solo developer**: cross-stack refactors land as one PR. No tag
  juggling between repos.
- **API contract churns**: every endpoint change has to land in
  backend, then frontend, then Android. Single PR keeps them in
  sync; separate repos invite drift.
- **CI cost**: a single workflow file per stack with `paths:` filters
  beats coordinating runs across repos.
- **Discoverability**: one clone gives the whole picture.

The usual monorepo objections do not apply here:

- *Repo gets huge* — current repo is small, even with `android/`
  it's well under 500 MB.
- *Tooling mismatch* — Gradle and Bun coexist because they don't
  talk to each other. Android Studio opens `android/` as its project
  root and ignores everything above.
- *CI scope* — `.github/workflows/*` with path filters scopes each
  job to what changed.

## When to split (future trigger)

Move `android/` to its own repo if:

- a separate team owns Android with its own release cadence,
- `shared/` graduates to a public npm + maven package that external
  consumers depend on (then the package needs its own repo for clean
  semver and a focused README),
- the repo grows past ~5 GB or `git status` starts taking seconds.

None of these are close.

## How `android/` integrates

- Gradle wrapper (`gradlew`) lives inside `android/`. Build commands
  always run from there: `cd android && ./gradlew assembleDebug`.
- Android Studio opens `android/` as the project root, not the repo
  root. Open `world/android` from the welcome screen, not `world/`.
- Add to `android/.gitignore`: `.gradle/`, `build/`, `local.properties`,
  `*.iml`, `.idea/` — the usual Android list.

## How `shared/` integrates

Two halves:

1. **`shared/openapi.yaml`** — single source of truth for the HTTP
   API. Either hand-written or emitted by the backend at build time
   (preferred: drift-free).
2. **`shared/scripts/`** — one script per client target:
   - `gen-ts-client.sh` → writes typed fetch client into
     `frontend/src/api/`.
   - `gen-kotlin-client.sh` → writes Retrofit interfaces and Kotlin
     data classes into `android/app/src/main/java/.../api/`.

Both scripts are idempotent. Re-running after a spec change updates
the generated files; CI fails if generated output drifts from
committed output.

## CI changes implied by the layout

New workflow `android-ci.yml`, triggered by:

```yaml
on:
  push:
    paths:
      - 'android/**'
      - 'shared/openapi.yaml'
      - '.github/workflows/android-ci.yml'
```

Jobs: `./gradlew :app:assembleDebug :app:testDebugUnitTest
:app:lintDebug`. Gradle caches keyed on `gradle/libs.versions.toml`
and wrapper checksum.

Existing `backend` and `frontend` workflows stay untouched.

## Files added by this design

Only documentation and placeholders so far. No Gradle, no Kotlin, no
generated clients — those land when the approach in `03-decision.md`
is chosen.

- `android/README.md`     — placeholder explaining what goes here
- `shared/README.md`      — placeholder explaining the contract folder
- `docs/android/*.md`     — these design docs
