# iOS migration — build, signing, debugging, native features

Claims marked **unconfirmed** come from reading source or secondary
sources and have not been run. Each maps to a spike in
`03-roadmap.md`.

## Building without a Mac

Capacitor 8 needs Xcode 26+ and Node 22+ to compile. New iOS projects
use Swift Package Manager, so CocoaPods is not needed.

| Step | Where |
|------|-------|
| `bun run build` (frontend + bundled backend) | Linux |
| `npx cap add ios` (once) | Linux. Verified with Capacitor 8.5.2: the generated project archives on the macOS runner. |
| `npx cap sync ios` | CI, before the archive step. It copies the web build and the Capacitor config into `ios/`; both are gitignored. |
| `xcodebuild archive` | GitHub Actions, `macos-26` runner |

`ios/` is generated once and committed. It contains
`AppDelegate.swift` from the Capacitor template; nobody edits it.

### Unsigned IPA in CI

```bash
xcodebuild archive \
  -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -archivePath build/World.xcarchive \
  CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO

mkdir Payload
cp -r build/World.xcarchive/Products/Applications/App.app Payload/
zip -r World-unsigned.ipa Payload
```

The workflow uploads `World-unsigned.ipa` as an artifact. It follows
`AGENTS.md` §13: top-level `permissions: contents: read`, actions
pinned to a commit SHA, a `paths:` filter so it runs only when
`frontend/`, `backend/` or `ios/` change.

Standard macOS runners are free on public repositories. On a private
repository they are billed per minute at the highest runner rate.

### App icon

The source is `ios/icon/app-icon.svg`. After editing it, regenerate the
three home-screen appearances from `ios/App/App/Assets.xcassets/AppIcon.appiconset/`:

```bash
magick ../../../../icon/app-icon.svg -alpha off AppIcon-512@2x.png
sed '/fill="url(#bg)"/d' ../../../../icon/app-icon.svg | magick -background none svg:- AppIcon-dark.png
sed '/fill="url(#bg)"/d' ../../../../icon/app-icon.svg | magick -background none svg:- -colorspace gray AppIcon-tinted.png
```

The light icon must be opaque, hence `-alpha off`. The dark and tinted
icons drop the background square: iOS draws its own dark background
behind them, and recolours the grey tinted one with the user's tint.

`frontend/public/favicon.svg` is the same sphere without the background
square; update it by hand when the sphere changes.

## Signing

The IPA is signed outside CI with an app signer. No certificate or
password is stored in the repository or in GitHub secrets.

What the signature allows depends on the certificate behind it:

| Capability | Free Apple ID | Paid developer certificate |
|------------|---------------|----------------------------|
| Install duration | 7 days, then re-sign | 1 year |
| Local notifications | yes | yes |
| Face ID | yes | yes |
| Remote push (APNs) | no | yes |
| iCloud | no | yes |
| App Groups (needed by widgets) | yes | yes |
| HealthKit | **unconfirmed**, sources conflict | yes |
| App extensions | each uses 1 of 10 App IDs | yes |

Signing services that use a shared or enterprise certificate decide
which entitlements their profile carries. That is specific to each
service and must be tested with the one in use.

### The profile in use

Read from the provisioning profiles on 2026-10-02. There are two, a
development one and an ad hoc distribution one, each bound to one
device.

| Property | Value | Consequence |
|----------|-------|-------------|
| Validity | one year, ends January 2027 | the app stops opening then; re-sign with a renewed profile |
| App ID | explicit, one per profile, name assigned by the service | the signer rewrites the bundle identifier to it; `capacitor.config.ts` cannot rely on its own |
| HealthKit | present, with background delivery | HealthKit is feasible |
| App Groups | present, five fixed group names | a group name must be one of those five, not one we choose |
| Push (`aps-environment`) | present | the app can register, but sending needs the account's APNs key, which we do not hold |
| iCloud | key-value store only, no containers | no CloudKit or iCloud Drive sync |
| Siri, time-sensitive notifications | present | available if wanted |
| `get-task-allow` | true on the development profile only | use that profile for debug builds |

The App ID, team identifier and group names identify the signing
account. They stay out of the repository: the build reads them from
local, uncommitted configuration.

The profile covers exactly one App ID. An app extension has its own
bundle identifier and needs its own profile, which this setup does not
provide.

## Debugging from Linux

Safari Web Inspector needs a Mac. What remains, in order of use:

1. **Desktop Chromium.** The app build runs in a browser with the
   same in-WebView backend. Most bugs are found here.
2. **An in-page console** (eruda or vConsole) in debug builds, for
   errors that only happen on the device.
3. **`ios-webkit-debug-proxy`** with `usbmuxd` over USB. Works on
   Linux and is unreliable; compatibility with current iOS is
   **unconfirmed**. Needs `ios.webContentsDebuggingEnabled: true` in
   `capacitor.config.ts`.
4. **inspect.dev**, a commercial inspector with a Linux client and a
   time-limited free tier.

Live reload from the phone needs `server.url` pointing at the Vite dev
server. Vite here binds to `127.0.0.1` only, so this needs a local,
uncommitted override.

There is no iOS simulator on Linux. Layout is checked on the device.

## Native features

| Feature | How | Swift by hand | Signing risk |
|---------|-----|---------------|--------------|
| Icon, full screen, splash | Capacitor config + assets | none | none |
| Offline | architecture | none | none |
| Local reminders | `@capacitor/local-notifications` | none | none |
| Backup via share sheet | `@capacitor/filesystem`, `@capacitor/share` | none | none |
| Face ID lock | `@capgo/capacitor-native-biometric` or `@aparajita/capacitor-biometric-auth` | none; one `Info.plist` key | none |
| HealthKit | `@capgo/capacitor-health` | none; `Info.plist` keys + entitlement | low: the profile carries the entitlement; untested on device |
| Siri Shortcuts / App Intents | no maintained plugin found | yes | low |
| Home-screen widget | WidgetKit extension | yes, SwiftUI | high |

### Why the widget is last

- Apple requires a WidgetKit extension written in SwiftUI. Plugins
  (`@capgo/capacitor-widget-kit`, `capacitor-widget-bridge`) only pass
  data to it.
- Adding an extension target normally happens in Xcode's interface.
  Without a Mac it means editing `project.pbxproj` by hand.
- The extension needs a provisioning profile for its own bundle
  identifier. The profile in use covers only the app's. Whether the
  signing service issues a second one is **unconfirmed**.
- The widget reads app data through an App Group. Sideloaded builds
  have a known failure where the widget cannot read it
  (SideStore issue #1437), and some signers strip extensions.
- The widget cannot run sql.js. The app has to write a small JSON
  summary to the App Group for it.

## Not available with this setup

- Remote push notifications: sending them needs the signing account's
  APNs key. Reminders are local and scheduled on the device.
- iCloud sync of the database: the profile has no iCloud container.
- App Store or TestFlight distribution. Both need the paid program.
