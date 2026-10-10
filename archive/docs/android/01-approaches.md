# Android conversion — approaches

Five candidate paths for delivering World on Android. Ordered by
effort, low → high.

## A. TWA / PWA wrapper

Wrap the existing PWA in a Trusted Web Activity. The "app" is a
fullscreen Chrome tab signed by the developer. Generated with
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap).

- **Effort**: 1–2 days, mostly icon and signing setup.
- **Reuse**: 100% of `frontend/`. No new UI code.
- **Native APIs**: only what the browser exposes (Web Bluetooth,
  Notifications API, IndexedDB). No background work, no widgets.
- **Distribution**: Play Store accepts TWAs but flags them as
  PWA-backed.
- **When this wins**: prove demand before investing more, or the web
  app already feels native enough on mobile.
- **When this loses**: anything offline-first, anything needing
  Android-specific UI (Material You, predictive back gesture,
  widgets, Wear OS).

## B. Capacitor (hybrid)

[Capacitor](https://capacitorjs.com/) bundles `frontend/` into a
WebView shell with a plugin bridge for native APIs. Built APK
contains the JS bundle plus a thin Kotlin host activity.

- **Effort**: 1–3 weeks for a polished release including plugin work
  and store assets.
- **Reuse**: ~90% of `frontend/`. shadcn/ui components keep working
  because they are still rendered by Chromium.
- **Native APIs**: any, through Capacitor plugins
  (`@capacitor/camera`, `@capacitor/biometric-auth`, etc.) or custom
  Kotlin plugin code.
- **Performance**: scrolling and animations feel "close to native"
  on modern Android (WebView is Chromium 110+). Heavy lists or
  custom gestures still show their roots.
- **Bundle size**: 8–25 MB.
- **When this wins**: time to first install matters, design system
  is already in `frontend/`, the app is form/list/chart shaped.
- **When this loses**: complex gestures, 120 Hz animation goals,
  battery-sensitive background features.

## C. React Native

Rewrite the UI in React Native. Logic and TypeScript types can be
factored out of `frontend/` into a shared package; the UI layer is
new.

- **Effort**: 4–8 weeks for feature parity.
- **Reuse**: 30–50% (business logic, validation, API client). Zero UI
  reuse — shadcn/ui is web-only.
- **Native APIs**: full access via native modules, ecosystem mature.
- **Cross-platform**: same code targets iOS later.
- **When this wins**: iOS is a near-term goal, the team prefers JS,
  there is appetite to maintain a parallel UI codebase.
- **When this loses**: solo developer who doesn't already own RN
  tooling — the surface area is large.

## D. Compose Multiplatform

Kotlin + Compose UI shared across Android, iOS, desktop, and (beta)
web. Backend stays as is.

- **Effort**: 3–8 weeks, with a learning ramp on Compose if new to
  it.
- **Reuse**: nothing from `frontend/`. UI is rewritten in Compose.
- **Native APIs**: full on Android, growing on iOS, mature on
  desktop.
- **Cross-platform**: single Compose UI on multiple targets.
- **When this wins**: future-proofing, Kotlin-first stack, more
  than one mobile target planned.
- **When this loses**: still maturing on iOS web targets, library
  ecosystem thinner than RN or native, learning cost if Compose is
  new.

## E. Native Kotlin + Jetpack Compose

Fresh Android app. Compose UI, Retrofit/Ktor for HTTP, Room or
DataStore for local persistence, talking to the existing backend.

- **Effort**: 4–12 weeks depending on familiarity with Compose.
- **Reuse**: API contract only. UI is built from scratch.
- **Native APIs**: full. Material You, predictive back, edge-to-edge
  insets, widgets via Glance, Wear OS later — all gratis.
- **Performance**: best of the bunch. 60–120 fps, lowest RAM, lowest
  battery, smallest APK.
- **When this wins**: long-term Android-first product, the dev
  wants to actually learn Android, polish matters.
- **When this loses**: time to first store release matters more than
  fit and finish.

## Side-by-side

| Dimension | TWA | Capacitor | RN | Compose MP | Native Kotlin |
|-----------|-----|-----------|----|------------|---------------|
| Effort to v1 | 1–2 d | 1–3 w | 4–8 w | 3–8 w | 4–12 w |
| `frontend/` reuse | 100% | ~90% | 30–50% | 0% | 0% |
| Native API access | minimal | via plugins | full | full | full |
| Cold start | 1.5–3 s | 0.8–2 s | 0.5–1 s | 0.3–0.8 s | 0.2–0.5 s |
| APK size | 1–2 MB | 8–25 MB | 15–30 MB | 5–15 MB | 3–10 MB |
| 60+ fps UI | flaky | yes-ish | yes | yes | yes |
| Material You theming | no | manual | manual | yes | yes (gratis) |
| Offline-first ergonomics | poor | ok | good | good | best |
| Long-term maintenance cost | low | low–med | med | med | med–high |
| Learning value (this repo) | low | low | medium | high | high |

## Cross-cutting notes

- All five paths can share `backend/` unchanged. The HTTP API is the
  single contract.
- Whatever path is chosen, an OpenAPI spec in `shared/` plus a code
  generator removes drift between web and Android clients. This is
  worth doing even before the Android implementation lands.
- Distribution effort (Play Store account, signing keys, store
  listing, screenshots) is the same regardless of approach. Budget a
  few days on top of the technical estimate.
