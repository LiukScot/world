import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../app-env.ts";

/**
 * Lets a request through only when the host has put a user on the context.
 * The app does that for every request (local-app.ts): one local user, no
 * login. A route reached without one answers 401 rather than reading another
 * user's rows.
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("userId") === undefined) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
  }
  await next();
});
