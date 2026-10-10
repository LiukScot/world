import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { requireAuth } from "./auth.ts";
import type { AppEnv } from "../app-env.ts";

function appWithUser(userId?: number) {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    if (userId !== undefined) c.set("userId", userId);
    await next();
  });
  app.get("/protected", requireAuth, (c) => c.json({ data: { userId: c.get("userId") } }));
  return app;
}

describe("requireAuth", () => {
  test("answers 401 when the host set no user", async () => {
    const res = await appWithUser().request("/protected");
    expect(res.status).toBe(401);
  });

  test("passes the user the host set", async () => {
    const res = await appWithUser(7).request("/protected");
    expect(res.status).toBe(200);
    expect((await res.json()).data.userId).toBe(7);
  });
});
