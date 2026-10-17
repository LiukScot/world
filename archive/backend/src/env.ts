import { z } from "zod";

export const envSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().default(5555),
  DB_PATH: z.string().default("../data/world.sqlite"),
  DB_JOURNAL_MODE: z.string().default("WAL"),
  SESSION_TTL_SECONDS: z.coerce.number().default(60 * 60 * 24 * 30),
  SESSION_COOKIE_NAME: z.string().default("WORLD_SESSID"),
  ALLOWED_ORIGINS: z.string().default("http://localhost:5173,http://127.0.0.1:5173,http://localhost:5555,http://127.0.0.1:5555"),
  PUBLIC_DIR: z.string().default("../frontend/dist"),
  DEV_FRONTEND_PROXY_URL: z.string().default(""),
  COOKIE_SECURE: z.string().default("true").transform(v => v.toLowerCase() === "true"),
  // Reverse proxies in front of the app that append to X-Forwarded-For.
  // 0 = none: the header is ignored and the socket address identifies the client.
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).default(0)
});

// The iOS build bundles this module into a WebView, where `process` does not
// exist; every value then takes its default.
const source = typeof process === "undefined" ? {} : process.env;

export const env = envSchema.parse(source);

if (!env.COOKIE_SECURE && source.NODE_ENV === "production") {
  throw new Error("COOKIE_SECURE must be true in production");
}

export const allowedOrigins = new Set(
  env.ALLOWED_ORIGINS.split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
