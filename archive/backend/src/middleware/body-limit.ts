import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";

const DEFAULT_BODY_MAX_BYTES = 1024 * 1024;

const limitBodySize = bodyLimit({
  maxSize: DEFAULT_BODY_MAX_BYTES,
  onError: (c) => c.json({ error: { code: "BODY_TOO_LARGE", message: "Request body exceeds 1 MB limit" } }, 413),
});

/**
 * Caps every API request body at 1 MB. Bun buffers up to 128 MB by default,
 * and login and register read their body before any credential is checked, so
 * an uncapped body is memory anyone can make the container spend. Routes
 * ending in /import are skipped: they carry their own, larger cap.
 */
export const defaultBodyLimit = createMiddleware((c, next) =>
  c.req.path.endsWith("/import") ? next() : limitBodySize(c, next),
);
