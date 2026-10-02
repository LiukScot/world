import fs from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { env, allowedOrigins } from "./env.ts";
import { runMigrations } from "./db.ts";
import { createDrizzle, openDb } from "./open-db.ts";
import type { AppEnv } from "./app-env.ts";
import { cleanupExpiredSessions } from "./middleware/auth.ts";
import { defaultBodyLimit } from "./middleware/body-limit.ts";

import auth from "./routes/auth.ts";
import { mountApiRoutes } from "./api.ts";

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
  // The script-src 'self' covers theme-init.js (frontend/public/theme-init.js).
  c.res.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'"
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

// Global middleware: request body cap
app.use("/api/*", defaultBodyLimit);

// Global middleware: inject database into context
app.use("/api/*", async (c, next) => {
  c.set("db", db);
  c.set("rawDb", rawDb);
  await next();
});

app.route("/api/v1/auth", auth);
mountApiRoutes(app);

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
    // Assigned, not resolved: a path like //other.host/x resolved against the
    // base would replace its host and send the request, cookies included,
    // wherever the path says.
    const upstreamUrl = new URL(devFrontendProxyUrl);
    upstreamUrl.pathname = requestUrl.pathname;
    upstreamUrl.search = requestUrl.search;
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
