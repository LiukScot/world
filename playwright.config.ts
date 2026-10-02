import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const smokePort = Number(process.env.SMOKE_PORT || 4173);
const smokeDbDir = fs.mkdtempSync(path.join(os.tmpdir(), "world-playwright-"));
const smokeDbPath = path.join(smokeDbDir, "smoke-world.sqlite");
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const quoteShell = (value: string) => JSON.stringify(value);

const devicePort = Number(process.env.DEVICE_PORT || 4174);

const serverBuild = {
  command: `rm -f ${quoteShell(smokeDbPath)} ${quoteShell(`${smokeDbPath}-shm`)} ${quoteShell(`${smokeDbPath}-wal`)} && DB_JOURNAL_MODE=DELETE DB_PATH=${quoteShell(smokeDbPath)} npm run smoke:seed && PORT=${smokePort} DB_JOURNAL_MODE=DELETE DB_PATH=${quoteShell(smokeDbPath)} COOKIE_SECURE=false npm run smoke:serve`,
  port: smokePort,
  reuseExistingServer: false,
  timeout: 180_000
};

// The build that carries its own backend. Served as static files: nothing
// answers /api, so a request that escapes the in-page backend fails the test.
const deviceBuild = {
  command: `cd frontend && bunx vite build --mode device && bunx vite preview --mode device --host 127.0.0.1 --port ${devicePort} --strictPort`,
  port: devicePort,
  reuseExistingServer: false,
  timeout: 180_000
};

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    headless: true
  },
  projects: [
    {
      name: "server",
      testIgnore: /device\.spec\.ts$/,
      use: { baseURL: externalBaseURL || `http://127.0.0.1:${smokePort}` }
    },
    ...(externalBaseURL
      ? []
      : [{ name: "device", testMatch: /device\.spec\.ts$/, use: { baseURL: `http://127.0.0.1:${devicePort}` } }])
  ],
  webServer: externalBaseURL ? undefined : [serverBuild, deviceBuild]
});
