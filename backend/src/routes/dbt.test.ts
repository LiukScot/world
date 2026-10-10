import { describe, expect, test } from "bun:test";
import dbtRoute from "./dbt.ts";
import { sessionCookieFor, seedUser, setupAuthedApp } from "../test-helpers.ts";

async function setup() {
  const s = await setupAuthedApp([
    { path: "/dbt", route: dbtRoute },
  ]);
  return { ctx: s.ctx, app: s.app, cookie: s.cookie, userId: s.user.id };
}

const validBody = {
  entryDate: "2026-05-16",
  entryTime: "12:00",
  emotionName: "anger",
  allowAffirmation: "this feeling can be here",
  watchEmotion: "watching the wave",
  bodyLocation: "chest",
  bodyFeeling: "tightness",
  presentMoment: "I am safe now",
  emotionReturns: "noticed it pass",
  intensity: 4,
};

describe("dbt route auth", () => {
  test("GET / requires authentication", async () => {
    const { app } = await setup();
    const res = await app.request("/dbt");
    expect(res.status).toBe(401);
  });

  test("POST / requires authentication", async () => {
    const { app } = await setup();
    const res = await app.request("/dbt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /dbt", () => {
  test("creates entry with valid body 201", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/dbt", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBeGreaterThan(0);
  });

  test("rejects missing entryDate with 400", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/dbt", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ ...validBody, entryDate: "" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /dbt", () => {
  test("returns empty array when no entries", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/dbt", { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  test("isolates entries across users (IDOR)", async () => {
    const { ctx, app, cookie } = await setup();
    await app.request("/dbt", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    await seedUser(ctx.db, { email: "other@example.com" });
    const otherCookie = sessionCookieFor(ctx.db, "other@example.com");
    const res = await app.request("/dbt", { headers: { cookie: otherCookie } });
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});

describe("PUT /dbt/:id", () => {
  test("updates entry and returns ok", async () => {
    const { app, cookie } = await setup();
    const created = await app.request("/dbt", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    const { data } = await created.json();
    const res = await app.request(`/dbt/${data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ ...validBody, emotionName: "joy" }),
    });
    expect(res.status).toBe(200);
  });

  test("returns 404 for non-existent id", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/dbt/99999", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(404);
  });

  test("returns 400 for non-numeric id (PR #82 regression)", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/dbt/abc", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(400);
  });

  test("cannot update another user's entry (IDOR)", async () => {
    const { ctx, app, cookie } = await setup();
    const created = await app.request("/dbt", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    const { data } = await created.json();
    await seedUser(ctx.db, { email: "other@example.com" });
    const otherCookie = sessionCookieFor(ctx.db, "other@example.com");
    const res = await app.request(`/dbt/${data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: otherCookie },
      body: JSON.stringify({ ...validBody, emotionName: "hacker" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /dbt/:id", () => {
  test("deletes entry and returns ok", async () => {
    const { app, cookie } = await setup();
    const created = await app.request("/dbt", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    const { data } = await created.json();
    const res = await app.request(`/dbt/${data.id}`, { method: "DELETE", headers: { cookie } });
    expect(res.status).toBe(200);
  });

  test("returns 400 for non-numeric id (PR #82 regression)", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/dbt/abc", { method: "DELETE", headers: { cookie } });
    expect(res.status).toBe(400);
  });
});

describe("dbt intensity", () => {
  test("round-trips the 1-9 value", async () => {
    const { app, cookie } = await setup();
    await app.request("/dbt", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    const list = await (await app.request("/dbt", { headers: { cookie } })).json();
    expect(list.data[0].intensity).toBe(4);
  });

  test("defaults to null when omitted", async () => {
    const { app, cookie } = await setup();
    const { intensity, ...withoutIntensity } = validBody;
    await app.request("/dbt", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(withoutIntensity),
    });
    const list = await (await app.request("/dbt", { headers: { cookie } })).json();
    expect(list.data[0].intensity).toBeNull();
  });

  test.each([0, 10, 4.5])("rejects out-of-range intensity %p with 400", async (intensity) => {
    const { app, cookie } = await setup();
    const res = await app.request("/dbt", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ ...validBody, intensity }),
    });
    expect(res.status).toBe(400);
  });
});
