# World

A personal tracking app for iOS. Data lives on the phone; the app needs no
server and no login. World is split into **realms** — self-contained areas you
switch between from the sidebar, each with its own navigation and accent
colour.

**Health** — logging daily mood, pain, and habits:

- Mood diary (mood, depression, anxiety levels + free text)
- Pain journal (pain area, symptoms, activities, medicines, habits, and more)
- CBT thought records and DBT distress tolerance entries
- Graphs and history over time
- Backup and restore your data

**Money** — portfolio, transactions, monthly movements and snapshots. Being
folded in from its own repo; the panels land one at a time.

- Import a bank PDF statement from the Transactions panel instead of typing the
  rows. Three are read: the Revolut robo-advisor statement, which also yields the
  period's revaluation; the Revolut savings statement; and the Cherry Bank account
  statement, read as the current account and the deposits it feeds together.
  The file is read in the browser and only the resulting transactions are sent. A statement whose own totals do not match its rows is
  refused.

---

## Development

Use Bun as the package manager. Install dependencies once:

```bash
bun run setup
```

Build the app and serve it in the browser:

```bash
bun run dev
```

Open [http://localhost:5600](http://localhost:5600). This is the same build the
iOS app ships: the API runs inside the page on a SQLite database kept in the
browser's storage. Run the command again after a change.

Tests:

```bash
bun run test:unit                 # backend routes
bun run --cwd frontend test       # frontend components
bun run test:e2e                  # Playwright, against the build above
```

The server version of World (Docker image, login, deploy) is archived in
[`archive/`](archive/README.md). It is not built or tested.

### Demo data

To see every page filled, write a demo backup:

```bash
bun run demo:seed
```

It writes `data/demo-backup.json`: a year of invented health and money data, with dates relative to today. Import it from Settings → Data. The import replaces the data already in the app, so use it on an empty or test install.

---

## iOS app

The iOS app holds its own data on the phone and needs no server or login.
Design and status: [`docs/ios/`](docs/ios/README.md).

**Install.** The `iOS` workflow uploads `World-unsigned.ipa` as an artifact. It
runs on every pull request that changes `frontend/`, `backend/` or `ios/`; to
build from `main`, start it from the Actions tab. Download the IPA from the
workflow run, sign it with your app signer, and install the signed file on the
phone.

**Update.** Sign and install the newer IPA over the old app. Data is kept as
long as the signer keeps the same bundle identifier. Deleting the app deletes
its data.

**Back up.** The database is `Library/world.sqlite` inside the app, so it is
part of the phone's iCloud or computer backup. To keep a copy you can restore
anywhere, open Settings → Data and export JSON; the share sheet lets you save
it to Files or send it elsewhere.

**Daily backup to WebDAV.** In Settings → Data, enter the WebDAV server
address (for Nextcloud: `https://<host>/remote.php/dav/files/<user>`), a
folder, username and password, turn on "Back up every day" and press Save.
"Back up now" uploads at once and shows any error. iOS does not run apps on a
timer, so the daily backup runs when you open the app and the last one is more
than a day old. Each backup is the whole database, named
`world-YYYY-MM-DD.sqlite`; the folder keeps the newest 30. The password is
stored in the iPhone Keychain and is not part of the backup.

**Restore from WebDAV.** On a new install, enter the same WebDAV settings in
Settings → Data, press Save, then "Show backups" and restore one. It replaces
all data on the phone, including the WebDAV settings; enter the password again
afterwards if the phone is new.

**Move data from the server.** On the server, export JSON from Settings →
Data. On the phone, import the file from the same screen. An import replaces
the phone's data for both realms.
