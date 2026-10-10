import { defineConfig } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const devicePort = Number(process.env.DEVICE_PORT || 4174);

// The build that carries its own backend. Served as static files: nothing
// answers /api, so a request that escapes the in-page backend fails the test.
const deviceBuild = {
  command: `cd frontend && bunx vite build && bunx vite preview --host 127.0.0.1 --port ${devicePort} --strictPort`,
  port: devicePort,
  reuseExistingServer: false,
  timeout: 180_000
};

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  use: {
    headless: true,
    baseURL: externalBaseURL || `http://127.0.0.1:${devicePort}`
  },
  webServer: externalBaseURL ? undefined : deviceBuild
});
