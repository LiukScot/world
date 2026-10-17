# Archive

World is developed as an iOS app only. The files here belonged to the server
version and the Android plans. They are kept for reference and are not built,
tested or deployed.

The code in this folder no longer compiles against the rest of the repository:
helpers it imported were removed when it moved here. To run the server version,
check out the last commit where it worked:

```bash
git switch --detach 0986ad5
```

## What is here

| Path | What it was |
|------|-------------|
| `backend/src/app.ts`, `server.ts` | The HTTP server: security headers, CORS, static files, login |
| `backend/src/routes/auth.ts` | Register, login, logout, change password |
| `backend/src/middleware/` | Login rate limit and request size limit |
| `backend/src/migrate.ts`, `user-cli.ts`, `backup-db.ts`, `restore-db.ts` | Command-line tools for the server database |
| `Dockerfile`, `docker-compose*.yml`, `.env.example` | The container image and how it ran locally and in production |
| `.github/workflows/release.yml` | Published the image to `ghcr.io/liukscot/world`; Watchtower on the server pulled it |
| `scripts/` | Local dev loop: backend on port 5555 with the Vite dev server |
| `tests/` | Playwright tests for login and password change |
| `android/`, `docs/android/`, `shared/` | Android design notes and the folder planned for a shared API contract; no code was written |
| `mockups/` | HTML mockups from early redesigns |

## Moving data off the server

A server that is still running keeps serving its last image. Export JSON from
Settings → Data there and import the file in the iOS app from the same screen.
