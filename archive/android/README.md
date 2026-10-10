# android/

Placeholder for the Android client of World.

**Status**: not implemented yet. Approach decision pending — see
[`docs/android/`](../docs/android/) for the comparison of options and
the criteria that will drive the choice.

When implementation starts, this directory will hold either:

- a full **Kotlin + Jetpack Compose** Android Studio project, or
- a **Capacitor** wrapper around the existing `frontend/`, or
- whatever else the decision in `docs/android/03-decision.md` lands on.

## Opening in Android Studio

Once code lives here, open Android Studio at this folder (not at the
monorepo root) — Gradle expects `settings.gradle.kts` at the project
root and gets confused by sibling `node_modules/`.

```
File → Open → <path-to-clone>/android
```

## Talking to the backend

The Android client talks to the same backend that powers `frontend/`.
Shared API types and generated clients live in [`../shared/`](../shared/).
