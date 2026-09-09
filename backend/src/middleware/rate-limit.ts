import type { Context } from "hono";
import { getConnInfo } from "hono/bun";
import { rateLimiter } from "hono-rate-limiter";

const WINDOW_MS = 15 * 60 * 1000;
const ATTEMPTS_PER_WINDOW = 10;

// First hop of X-Forwarded-For when a proxy fronts the container, else the
// socket peer. null only when there is no socket at all (in-process tests).
function clientIp(c: Context): string | null {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  try {
    return getConnInfo(c).remote.address ?? null;
  } catch {
    return null;
  }
}

/**
 * Caps credential guessing per client IP. In-memory, so the counter resets
 * with the process and is per instance; that matches the single-container
 * deployment this app has.
 */
export const authRateLimit = rateLimiter({
  windowMs: WINDOW_MS,
  limit: ATTEMPTS_PER_WINDOW,
  standardHeaders: "draft-6",
  keyGenerator: (c) => clientIp(c) ?? "",
  skip: (c) => clientIp(c) === null,
  handler: (c) =>
    c.json({ error: { code: "RATE_LIMITED", message: "Too many attempts, try again in a few minutes" } }, 429),
});
