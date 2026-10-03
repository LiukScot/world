# World

A personal tracking app behind one login. World is split into **realms** —
self-contained areas you switch between from the sidebar, each with its own
navigation and accent colour.

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

Use Bun as the package manager for local development.

Install dependencies once:

```bash
bun run setup
```

For day-to-day development, use the root dev command:

```bash
bun run dev
```

This starts both the backend and frontend locally with file watching for the fastest edit loop. Open [http://localhost:5555](http://localhost:5555) and keep using that URL while you edit both backend and frontend files.

The frontend dev server still binds locally on port `5173` for Vite's internal HMR connection, but you do not need to browse to that port during normal development.

If you want Docker parity for the backend instead, use:

```bash
bun run dev:docker
```

That keeps the frontend local for fast HMR, but runs the backend in Docker using the dev override.

To stop the Docker backend container after a dev session:

```bash
bun run dev:stop
```

---

## Running with Docker (recommended)

For a production-style local run, use Docker directly.

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/).

1. Copy the example env file and fill in your values:

   ```bash
   cp .env.example .env
   ```

2. Start the app:

   ```bash
   docker compose up --build -d
   ```

3. Create your user account:

   ```bash
   docker exec world bun --cwd backend src/user-cli.ts create \
     --email=you@example.com \
     --password=YourPassword \
     --name=YourName
   ```

4. Open [http://localhost:5555](http://localhost:5555) and log in.

---

## Deploying

Push to `main` and the server picks it up: GitHub Actions builds the image,
publishes it to `ghcr.io/liukscot/world:latest`, and Watchtower on the server
pulls it. `docker-compose.prod.yml` is what runs there.

---

## Data & backup

Your data is stored in `data/world.sqlite`. The app runs migrations automatically on startup — no manual steps needed.

> **Upgrading from a release named `health`:** rename the database file to
> `world.sqlite` **together with its `-wal` and `-shm` companions** before
> starting the new version, or SQLite creates an empty database and the app
> comes up with no data. The session cookie is also renamed, so everyone is
> signed out once on the first start.

To back up or restore your data:

```bash
bun run backup          # creates a backup of the DB
bun run restore         # restores from a backup file
```

You can also export and import all data, Health and Money together, as one JSON or Excel file from the app (Settings → Data). An import replaces the data the file contains. Files exported before this single backup, one per realm, still import.

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
