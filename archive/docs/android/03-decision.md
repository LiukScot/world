# Android conversion — decision

No decision yet. This file records the criteria the decision will be
made against and the current leaning, so the next pass can either
commit or revise.

## Criteria, ranked

1. **Learning value for the maintainer.** This project doubles as a
   way to learn Android. Approaches that teach more — native Kotlin,
   Compose — score higher even at a cost in time.
2. **Time to a usable v1.** "Usable" = installable APK, login,
   record an entry, view history. Not store-ready.
3. **Long-term maintenance cost for a solo developer.** Two parallel
   UI codebases (RN, Compose Multiplatform if web is also a target)
   cost more than one.
4. **UX fit and polish ceiling.** Material You, gestures, widgets,
   notifications. Anything the browser cannot reach is a permanent
   ceiling for TWA and a soft ceiling for Capacitor.
5. **Reusability of `frontend/`**. High reuse means changes to the
   web app come along for free; low reuse means two UIs to keep
   feature-parity.

## How each approach scores

Score: ✓ good fit, ~ partial, ✗ poor fit.

| Approach | Learning | TTV v1 | Maint. | UX ceiling | Reuse |
|----------|----------|--------|--------|------------|-------|
| TWA | ✗ | ✓ | ✓ | ✗ | ✓ |
| Capacitor | ~ | ✓ | ✓ | ~ | ✓ |
| React Native | ~ | ~ | ~ | ✓ | ~ |
| Compose Multiplatform | ✓ | ~ | ~ | ✓ | ✗ |
| Native Kotlin + Compose | ✓ | ✗ | ~ | ✓ | ✗ |

## Current leaning: native Kotlin + Compose (E)

Reasons:

- Criterion 1 (learning) dominates. The user has explicitly said they
  want to learn Android, and the other approaches either skip Android
  entirely (TWA, Capacitor) or teach a layer on top of it (RN,
  Compose Multiplatform).
- Solo dev means cross-platform abstractions (RN, Compose MP) cost
  more than they save: there is no iOS team in the picture.
- The web app is small enough that two UI codebases is sustainable.
- Capacitor remains the fallback if priorities flip toward
  time-to-store.

## What needs to happen before deciding

- [ ] Confirm with the user that learning is the top criterion (not
      time-to-store).
- [ ] Confirm there is no near-term iOS plan. If iOS lands within
      ~6 months, reconsider RN or Compose Multiplatform.
- [ ] Sketch the v1 feature list. If it grows past "auth + CRUD +
      one chart," Capacitor's reuse advantage gets bigger.
- [ ] Decide whether `shared/openapi.yaml` is hand-written or
      backend-emitted. This decision is independent of approach but
      blocks the codegen scripts.

## Reversibility

The approach is reversible at low cost while `android/` is empty.
After a few weeks of Kotlin code, a switch to Capacitor means
discarding the UI work — backend and `shared/` stay intact either
way. The point of no return is roughly "first beta release".

## Open questions

- Where will the Android app fetch the backend? Localhost for dev is
  obvious; for production, does the app point at a single hosted
  instance or is it self-hosted per-user?
- Auth: does the existing web auth (session cookie?) translate
  cleanly to a mobile client, or does Android need bearer tokens
  with refresh?
- Push notifications: in scope for v1 or later? FCM setup is its own
  multi-day side quest.
