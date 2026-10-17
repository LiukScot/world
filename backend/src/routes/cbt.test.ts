import { describe, expect, test } from "bun:test";
import cbtRoute from "./cbt.ts";
import { sessionCookieFor, seedUser, setupAuthedApp } from "../test-helpers.ts";

async function setup() {
  const s = await setupAuthedApp([
    { path: "/cbt", route: cbtRoute },
  ]);
  return { ctx: s.ctx, app: s.app, cookie: s.cookie, userId: s.user.id };
}

const validBody = {
  entryDate: "2026-05-16",
  entryTime: "11:00",
  situation: "Got stuck",
  thoughts: "I cannot do this",
  mainUnhelpfulThought: "I am useless",
  effectOfBelieving: "Paralysed",
  evidenceForAgainst: "Done it before",
  alternativeExplanation: "First time is hard",
  worstBestScenario: "Worst: fail. Best: learn",
  friendAdvice: "Be kind to yourself",
  productiveResponse: "Take a break, retry",
  intensity: 7,
};

describe("cbt route auth", () => {
  test("GET / requires authentication", async () => {
    const { app } = await setup();
    const res = await app.request("/cbt");
    expect(res.status).toBe(401);
  });

  test("POST / requires authentication", async () => {
    const { app } = await setup();
    const res = await app.request("/cbt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /cbt", () => {
  test("creates entry with valid body 201", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/cbt", {
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
    const res = await app.request("/cbt", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ ...validBody, entryDate: "" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /cbt", () => {
  test("returns empty array when no entries", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/cbt", { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  test("returns entries ordered by date desc", async () => {
    const { app, cookie } = await setup();
    await app.request("/cbt", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ ...validBody, entryDate: "2026-05-10" }),
    });
    await app.request("/cbt", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ ...validBody, entryDate: "2026-05-15" }),
    });
    const res = await app.request("/cbt", { headers: { cookie } });
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].entryDate).toBe("2026-05-15");
  });

  test("isolates entries across users (IDOR)", async () => {
    const { ctx, app, cookie } = await setup();
    await app.request("/cbt", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    await seedUser(ctx.db, { email: "other@example.com" });
    const otherCookie = sessionCookieFor(ctx.db, "other@example.com");
    const res = await app.request("/cbt", { headers: { cookie: otherCookie } });
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});

describe("PUT /cbt/:id", () => {
  test("updates entry and returns ok", async () => {
    const { app, cookie } = await setup();
    const created = await app.request("/cbt", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    const { data } = await created.json();
    const res = await app.request(`/cbt/${data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ ...validBody, situation: "updated" }),
    });
    expect(res.status).toBe(200);
  });

  test("returns 404 for non-existent id", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/cbt/99999", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(404);
  });

  test("returns 400 for non-numeric id (PR #82 regression)", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/cbt/abc", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(400);
  });

  test("cannot update another user's entry (IDOR)", async () => {
    const { ctx, app, cookie } = await setup();
    const created = await app.request("/cbt", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    const { data } = await created.json();
    await seedUser(ctx.db, { email: "other@example.com" });
    const otherCookie = sessionCookieFor(ctx.db, "other@example.com");
    const res = await app.request(`/cbt/${data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: otherCookie },
      body: JSON.stringify({ ...validBody, situation: "hacker" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /cbt/:id", () => {
  test("deletes entry and returns ok", async () => {
    const { app, cookie } = await setup();
    const created = await app.request("/cbt", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    const { data } = await created.json();
    const res = await app.request(`/cbt/${data.id}`, { method: "DELETE", headers: { cookie } });
    expect(res.status).toBe(200);
  });

  test("returns 400 for non-numeric id (PR #82 regression)", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/cbt/abc", { method: "DELETE", headers: { cookie } });
    expect(res.status).toBe(400);
  });
});

describe("cbt intensity", () => {
  test("round-trips the 1-9 value", async () => {
    const { app, cookie } = await setup();
    await app.request("/cbt", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    const list = await (await app.request("/cbt", { headers: { cookie } })).json();
    expect(list.data[0].intensity).toBe(7);
  });

  test("defaults to null when omitted", async () => {
    const { app, cookie } = await setup();
    const { intensity, ...withoutIntensity } = validBody;
    await app.request("/cbt", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(withoutIntensity),
    });
    const list = await (await app.request("/cbt", { headers: { cookie } })).json();
    expect(list.data[0].intensity).toBeNull();
  });

  test.each([0, 10, 4.5])("rejects out-of-range intensity %p with 400", async (intensity) => {
    const { app, cookie } = await setup();
    const res = await app.request("/cbt", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ ...validBody, intensity }),
    });
    expect(res.status).toBe(400);
  });
});
