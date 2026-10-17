import { describe, expect, test } from "bun:test";
import moneyPrefsRoute from "./money-prefs.ts";
import preferencesRoute from "./preferences.ts";
import { setupAuthedApp } from "../test-helpers.ts";

async function setup() {
  return setupAuthedApp([
    { path: "/money/preferences", route: moneyPrefsRoute },
    { path: "/preferences", route: preferencesRoute },
  ]);
}

function putMoney(app: Awaited<ReturnType<typeof setup>>["app"], cookie: string, showZeroAssets: boolean) {
  return app.request("/money/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ showZeroAssets }),
  });
}

function putHealth(app: Awaited<ReturnType<typeof setup>>["app"], cookie: string, chatRange: string) {
  return app.request("/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ model: "m", chatRange, lastRange: "all", graphSelection: { mood: true } }),
  });
}

describe("money preferences", () => {
  test("requires authentication", async () => {
    const { app } = await setup();
    expect((await app.request("/money/preferences")).status).toBe(401);
  });

  test("defaults to false with no row", async () => {
    const { app, cookie } = await setup();
    const body = await (await app.request("/money/preferences", { headers: { cookie } })).json();
    expect(body.data.showZeroAssets).toBe(false);
  });

  test("persists the flag both ways", async () => {
    const { app, cookie } = await setup();
    expect((await putMoney(app, cookie, true)).status).toBe(200);
    let body = await (await app.request("/money/preferences", { headers: { cookie } })).json();
    expect(body.data.showZeroAssets).toBe(true);

    await putMoney(app, cookie, false);
    body = await (await app.request("/money/preferences", { headers: { cookie } })).json();
    expect(body.data.showZeroAssets).toBe(false);
  });

  test("rejects a non-boolean flag", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/money/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ showZeroAssets: "yes" }),
    });
    expect(res.status).toBe(400);
  });
});

// Both realms upsert the same user_preferences row, so each has to leave the
// other's columns alone — in either write order.
describe("money and health preferences share one row", () => {
  test("saving money preferences keeps the health ones", async () => {
    const { app, cookie } = await setup();
    expect((await putHealth(app, cookie, "30d")).status).toBe(200);
    expect((await putMoney(app, cookie, true)).status).toBe(200);

    const health = await (await app.request("/preferences", { headers: { cookie } })).json();
    expect(health.data.chatRange).toBe("30d");
    expect(health.data.graphSelection).toEqual({ mood: true });
    expect(health.data.model).toBe("m");
  });

  test("saving health preferences keeps the money one", async () => {
    const { app, cookie } = await setup();
    expect((await putMoney(app, cookie, true)).status).toBe(200);
    expect((await putHealth(app, cookie, "90d")).status).toBe(200);

    const money = await (await app.request("/money/preferences", { headers: { cookie } })).json();
    expect(money.data.showZeroAssets).toBe(true);
  });
});
