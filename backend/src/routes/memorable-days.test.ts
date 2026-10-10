import { describe, expect, test } from "bun:test";
import memorableDaysRoute from "./memorable-days.ts";
import { sessionCookieFor, seedUser, setupAuthedApp } from "../test-helpers.ts";

async function setup() {
  const s = await setupAuthedApp([
    { path: "/memorable-days", route: memorableDaysRoute },
  ]);
  return { ctx: s.ctx, app: s.app, cookie: s.cookie, userId: s.user.id };
}

const validBody = {
  date: "2026-08-15",
  title: "Summer trip",
  emoji: "🏖️",
  description: "beach week",
};

describe("memorable-days auth", () => {
  test("GET / requires authentication", async () => {
    const { app } = await setup();
    const res = await app.request("/memorable-days");
    expect(res.status).toBe(401);
  });

  test("POST / requires authentication", async () => {
    const { app } = await setup();
    const res = await app.request("/memorable-days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /memorable-days", () => {
  test("creates entry with valid body 201", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/memorable-days", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBeGreaterThan(0);
  });

  test("rejects invalid calendar date with 400", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/memorable-days", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ ...validBody, date: "2026-02-30" }),
    });
    expect(res.status).toBe(400);
  });

  test("rejects empty title with 400", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/memorable-days", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ ...validBody, title: "   " }),
    });
    expect(res.status).toBe(400);
  });

});

describe("GET /memorable-days", () => {
  test("returns empty list when no entries", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/memorable-days", { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  test("returns the stored entry on its own date, with no recurrence fields", async () => {
    const { app, cookie } = await setup();
    await app.request("/memorable-days", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    const res = await app.request("/memorable-days", { headers: { cookie } });
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ date: validBody.date, title: validBody.title });
    expect(body.data[0]).not.toHaveProperty("repeatMode");
    expect(body.data[0]).not.toHaveProperty("occurrenceLabel");
  });

  test("isolates entries across users (IDOR)", async () => {
    const { ctx, app, cookie } = await setup();
    const created = await app.request("/memorable-days", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    expect(created.status).toBe(201);
    await seedUser(ctx.db, { email: "other@example.com" });
    const otherCookie = sessionCookieFor(ctx.db, "other@example.com");
    const res = await app.request("/memorable-days", { headers: { cookie: otherCookie } });
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});

describe("PUT /memorable-days/:id", () => {
  test("updates entry and returns ok", async () => {
    const { app, cookie } = await setup();
    const created = await app.request("/memorable-days", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    const { data } = await created.json();
    const res = await app.request(`/memorable-days/${data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ ...validBody, title: "Updated title" }),
    });
    expect(res.status).toBe(200);
  });

  test("returns 400 for invalid id", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/memorable-days/abc", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(400);
  });

  test("cannot update another user's entry (IDOR)", async () => {
    const { ctx, app, cookie } = await setup();
    const created = await app.request("/memorable-days", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    expect(created.status).toBe(201);
    const { data } = await created.json();
    await seedUser(ctx.db, { email: "other@example.com" });
    const otherCookie = sessionCookieFor(ctx.db, "other@example.com");
    const res = await app.request(`/memorable-days/${data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: otherCookie },
      body: JSON.stringify({ ...validBody, title: "hacker" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /memorable-days/:id", () => {
  test("deletes entry and returns ok", async () => {
    const { app, cookie } = await setup();
    const created = await app.request("/memorable-days", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    const { data } = await created.json();
    const res = await app.request(`/memorable-days/${data.id}`, { method: "DELETE", headers: { cookie } });
    expect(res.status).toBe(200);
  });

  test("returns 400 for invalid id", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/memorable-days/abc", { method: "DELETE", headers: { cookie } });
    expect(res.status).toBe(400);
  });
});
