import { describe, expect, test } from "bun:test";
import preferencesRoute from "./preferences.ts";
import { sessionCookieFor, seedUser, setupAuthedApp } from "../test-helpers.ts";

async function setup() {
  const s = await setupAuthedApp([
    { path: "/preferences", route: preferencesRoute },
  ]);
  return { ctx: s.ctx, app: s.app, cookie: s.cookie, userId: s.user.id };
}

describe("preferences auth", () => {
  test("GET / requires authentication", async () => {
    const { app } = await setup();
    const res = await app.request("/preferences");
    expect(res.status).toBe(401);
  });

  test("PUT / requires authentication", async () => {
    const { app } = await setup();
    const res = await app.request("/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "x", chatRange: "all", lastRange: "all", graphSelection: {} }),
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /preferences", () => {
  test("returns defaults when no row exists", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/preferences", { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.model).toBe("mistral-small-latest");
    expect(body.data.chatRange).toBe("all");
  });
});

describe("PUT /preferences", () => {
  test("persists model + chatRange + graphSelection", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        model: "mistral-large-latest",
        chatRange: "30d",
        lastRange: "7d",
        graphSelection: { mood: true },
      }),
    });
    expect(res.status).toBe(200);
    const get = await (await app.request("/preferences", { headers: { cookie } })).json();
    expect(get.data.model).toBe("mistral-large-latest");
    expect(get.data.chatRange).toBe("30d");
    expect(get.data.graphSelection).toEqual({ mood: true });
  });

  test("upsert merges existing row (PUT twice keeps last values)", async () => {
    const { app, cookie } = await setup();
    await app.request("/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        model: "model-a",
        chatRange: "all",
        lastRange: "all",
        graphSelection: {},
      }),
    });
    await app.request("/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        model: "model-b",
        chatRange: "7d",
        lastRange: "all",
        graphSelection: {},
      }),
    });
    const get = await (await app.request("/preferences", { headers: { cookie } })).json();
    expect(get.data.model).toBe("model-b");
    expect(get.data.chatRange).toBe("7d");
  });

  test("isolates preferences across users (IDOR)", async () => {
    const { ctx, app, cookie } = await setup();
    const put = await app.request("/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        model: "user-a-model",
        chatRange: "all",
        lastRange: "all",
        graphSelection: {},
      }),
    });
    expect(put.status).toBe(200);
    await seedUser(ctx.db, { email: "other@example.com" });
    const otherCookie = sessionCookieFor(ctx.db, "other@example.com");
    const res = await (
      await app.request("/preferences", { headers: { cookie: otherCookie } })
    ).json();
    expect(res.data.model).toBe("mistral-small-latest");
  });
});
