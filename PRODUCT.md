# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The only target in use is the iOS app: the React frontend runs inside a
Capacitor WKWebView on iPhone, with the backend bundled in the page. The
desktop browser version is archived and is not a design target.

## Users

One person, the owner, on their own iPhone. No other accounts or
audiences.

## Product Purpose

World is a personal tracking app split into realms, each with its own
navigation and accent colour.

- **Health**: a welcoming diary (mood, pain, habits, CBT thought records,
  DBT distress tolerance, memorable days) that also works as a database
  to export.
- **Money**: automates and tracks the movements of the owner's
  portfolio (transactions, monthly movements, snapshots, bank PDF
  statement import).

Success: logging takes seconds on a bad day, and the stored data is
complete and exportable.

## Positioning

A single private app that holds both health and money records, owned
and stored entirely by the user, offline on the device, with data
structured for export rather than locked in.

## Operating Context

- Quick entries on iPhone, often on days with low energy or pain.
- Works offline: the device build runs queries in-page without a server.
- Health history is shown or exported for therapy sessions.
- Backups: JSON/Excel export and import from Settings → Data, plus a
  daily WebDAV backup on iOS.
- Money data comes in by importing bank PDF statements (Revolut
  robo-advisor, Revolut savings, Cherry Bank), read on the device.

## Capabilities and Constraints

- UI copy is in English (`lang="en"`, no i18n helper).
- An imported statement whose own totals do not match its rows is
  refused.

## Brand Commitments

- Dark theme is the default.
- Each realm has its own accent colour (Health pink, Money green).
- App icon: layered sphere (`ios/icon/app-icon.svg`).

## Evidence on Hand

Real data is the owner's own and private. Screens must not show
invented sample entries presented as real usage.

## Product Principles

1. Fast capture first: an entry must be possible in a few taps on a phone.
2. Welcoming, not clinical: the Health diary should feel safe to open on
   a hard day.
3. Data is the owner's: every record is exportable and survives backup
   and restore.
4. Offline is the normal case, not a fallback.
