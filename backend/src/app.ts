import fs from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { env, allowedOrigins } from "./env.ts";
import { openDb, runMigrations } from "./db.ts";
import { createDrizzle } from "./db/index.ts";
import type { AppEnv } from "./app-env.ts";
import { cleanupExpiredSessions } from "./middleware/auth.ts";

import auth from "./routes/auth.ts";
import diary from "./routes/diary.ts";
import pain from "./routes/pain.ts";
import mood from "./routes/mood.ts";
import preferences from "./routes/preferences.ts";
import memorableDays from "./routes/memorable-days.ts";
import cbt from "./routes/cbt.ts";
import dbt from "./routes/dbt.ts";
import backup from "./routes/backup.ts";
import moneyTransactions from "./routes/money-transactions.ts";
import moneyMovements from "./routes/money-movements.ts";
import moneySnapshots from "./routes/money-snapshots.ts";
import moneyStyles from "./routes/money-styles.ts";
import moneyPrefs from "./routes/money-prefs.ts";
import moneyBackup from "./routes/money-backup.ts";

// Initialize database
fs.mkdirSync(path.dirname(env.DB_PATH), { recursive: true });
const rawDb = openDb(env.DB_PATH, env.DB_JOURNAL_MODE);
runMigrations(rawDb);
const db = createDrizzle(rawDb);

// Clean up expired sessions on startup
cleanupExpiredSessions(rawDb);


const app = new Hono<AppEnv>();

// Global middleware: security headers
app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  c.res.headers.set("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  // The script-src 'self' covers theme-init.js (frontend/public/theme-init.js);
  // the Google Fonts origins are required by its <link rel="stylesheet"> and
  // the woff2 files it loads.
  c.res.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; connect-src 'self'; font-src 'self' https://fonts.gstatic.com; object-src 'none'; frame-ancestors 'none'"
  );
});

// Global middleware: CORS
app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      if (!origin) return origin;
      if (allowedOrigins.has(origin)) return origin;
      return null;
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"]
  })
);

// Global middleware: inject database into context
app.use("/api/*", async (c, next) => {
  c.set("db", db);
  c.set("rawDb", rawDb);
  await next();
});

// Mount API routes
app.route("/api/v1/auth", auth);
app.route("/api/v1/diary", diary);
app.route("/api/v1/pain", pain);
app.route("/api/v1/mood", mood);
app.route("/api/v1/cbt", cbt);
app.route("/api/v1/dbt", dbt);
app.route("/api/v1/preferences", preferences);
app.route("/api/v1/memorable-days", memorableDays);
app.route("/api/v1/backup", backup);
app.route("/api/v1/data", backup);

// Money realm. Namespaced because /preferences and /backup would otherwise
// collide with the health routes above.
app.route("/api/v1/money/transactions", moneyTransactions);
app.route("/api/v1/money/monthly-movements", moneyMovements);
app.route("/api/v1/money/monthly-snapshots", moneySnapshots);
app.route("/api/v1/money/assets/styles", moneyStyles);
app.route("/api/v1/money/preferences", moneyPrefs);
app.route("/api/v1/money/backup", moneyBackup);
app.route("/api/v1/money/data", moneyBackup);

// API 404 fallback
app.all("/api/*", (c) => {
  return c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404);
});

// Block other app routes that don't belong to this app
const blockedPrefixes = ["/hub", "/myhealth", "/health", "/mymoney"];
app.use("*", async (c, next) => {
  const pathname = new URL(c.req.url).pathname;
  for (const prefix of blockedPrefixes) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404);
    }
  }
  await next();
});

// Static file serving + SPA fallback
const publicDir = env.PUBLIC_DIR;
const devFrontendProxyUrl = env.DEV_FRONTEND_PROXY_URL.trim();

async function proxyDevFrontend(request: Request): Promise<Response> {
  try {
    const requestUrl = new URL(request.url);
    const upstreamUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, `${devFrontendProxyUrl}/`);
    const headers = new Headers(request.headers);

    headers.set("host", upstreamUrl.host);
    headers.set("x-forwarded-host", requestUrl.host);
    headers.set("x-forwarded-proto", requestUrl.protocol.replace(":", ""));

    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      redirect: "manual"
    });

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: upstreamResponse.headers
    });
  } catch (error) {
    console.error("Failed to reach frontend dev server", error);
    return new Response(
      "Frontend dev server is unavailable. Run `bun run dev` from the repo root to start it.",
      { status: 502 }
    );
  }
}

function resolveStaticFile(requestPath: string): string | null {
  const normalized = requestPath === "/" ? "/index.html" : requestPath;
  const unsafePath = path.resolve(publicDir, `.${normalized}`);
  const safeRoot = path.resolve(publicDir);
  if (unsafePath !== safeRoot && !unsafePath.startsWith(safeRoot + path.sep)) return null;
  if (fs.existsSync(unsafePath) && fs.statSync(unsafePath).isFile()) {
    return unsafePath;
  }
  return null;
}

app.get("*", (c) => {
  const pathname = new URL(c.req.url).pathname;

  if (devFrontendProxyUrl) {
    return proxyDevFrontend(c.req.raw);
  }

  // Try exact static file
  const staticFile = resolveStaticFile(pathname);
  if (staticFile) {
    return new Response(Bun.file(staticFile));
  }

  // SPA fallback — serve index.html
  const indexFile = path.resolve(publicDir, "index.html");
  if (fs.existsSync(indexFile)) {
    return new Response(Bun.file(indexFile));
  }

  return c.text("World backend running. Frontend build not found.");
});

// Global error handler
app.onError((err, c) => {
  console.error(`[${err.name}] ${err.message}`);
  if (err instanceof HTTPException) return err.getResponse();
  if (err instanceof Response) return err;
  return c.json(
    { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
    500
  );
});

export default app;
