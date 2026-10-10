import type { Context } from "hono";
import { getConnInfo } from "hono/bun";
import { rateLimiter } from "hono-rate-limiter";
import { env } from "../env.ts";

const WINDOW_MS = 15 * 60 * 1000;
const ATTEMPTS_PER_WINDOW = 10;

/**
 * Picks the address that identifies the client. Each proxy appends the address
 * it received the request from to X-Forwarded-For, so only the last
 * `trustedHops` entries were written by our own proxies; anything further left
 * came from the client and can be made up. With no trusted proxy, or fewer
 * entries than proxies, the socket address is the only one nobody can forge.
 */
export function resolveClientIp(
  forwardedFor: string | undefined,
  socketAddress: string | null,
  trustedHops: number,
): string | null {
  if (trustedHops > 0 && forwardedFor) {
    const hops = forwardedFor.split(",").map((hop) => hop.trim());
    const fromProxy = hops[hops.length - trustedHops];
    if (fromProxy) return fromProxy;
  }
  return socketAddress;
}

// null only when there is no usable address at all (in-process tests).
function clientIp(c: Context): string | null {
  let socketAddress: string | null = null;
  try {
    socketAddress = getConnInfo(c).remote.address ?? null;
  } catch {
    // No socket: the request did not come through Bun.serve.
  }
  return resolveClientIp(c.req.header("x-forwarded-for"), socketAddress, env.TRUSTED_PROXY_HOPS);
}

// In-memory, so the counter resets with the process and is per instance; that
// matches the single-container deployment this app has.
function perClientLimit(skipSuccessfulRequests: boolean) {
  return rateLimiter({
    windowMs: WINDOW_MS,
    limit: ATTEMPTS_PER_WINDOW,
    standardHeaders: "draft-6",
    skipSuccessfulRequests,
    keyGenerator: (c) => clientIp(c) ?? "",
    skip: (c) => clientIp(c) === null,
    handler: (c) =>
      c.json({ error: { code: "RATE_LIMITED", message: "Too many attempts, try again in a few minutes" } }, 429),
  });
}

/**
 * Caps credential guessing per client IP: only rejected attempts count, so
 * signing in normally never trips it.
 */
export const authRateLimit = perClientLimit(true);

/**
 * Caps account creation per client IP. Every request counts: a successful
 * registration is the thing being limited, since each one costs a password
 * hash and leaves a row behind.
 */
export const registerRateLimit = perClientLimit(false);
