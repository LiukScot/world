import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { defaultBodyLimit } from "./body-limit.ts";

function createApp() {
  const app = new Hono();
  app.use("/api/*", defaultBodyLimit);
  app.post("/api/v1/auth/login", async (c) => c.json({ bytes: (await c.req.text()).length }));
  app.post("/api/v1/backup/json/import", async (c) => c.json({ bytes: (await c.req.text()).length }));
  return app;
}

const post = (app: Hono, path: string, body: string) =>
  app.request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body });

describe("defaultBodyLimit", () => {
  const oversized = "x".repeat(1024 * 1024 + 1);

  test("refuses a body over 1 MB", async () => {
    const res = await post(createApp(), "/api/v1/auth/login", oversized);
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe("BODY_TOO_LARGE");
  });

  test("lets a body under the cap through", async () => {
    const res = await post(createApp(), "/api/v1/auth/login", "x".repeat(1024));
    expect(res.status).toBe(200);
    expect((await res.json()).bytes).toBe(1024);
  });

  test("leaves import routes to their own cap", async () => {
    const res = await post(createApp(), "/api/v1/backup/json/import", oversized);
    expect(res.status).toBe(200);
    expect((await res.json()).bytes).toBe(oversized.length);
  });
});
