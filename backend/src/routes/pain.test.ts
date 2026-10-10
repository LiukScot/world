import { describe, expect, test } from "bun:test";
import painRoute from "./pain.ts";
import { sessionCookieFor, seedUser, setupAuthedApp } from "../test-helpers.ts";

async function setup() {
  const s = await setupAuthedApp([
    { path: "/pain", route: painRoute },
  ]);
  return { ctx: s.ctx, app: s.app, cookie: s.cookie, userId: s.user.id };
}

const validBody = {
  entryDate: "2026-05-16",
  entryTime: "10:00",
  painLevel: 5,
  fatigueLevel: 4,
  coffeeCount: 2,
  area: "back",
  symptoms: "ache",
  activities: "walking",
  medicines: "",
  habits: "",
  other: "",
  note: "Test pain entry",
};

describe("pain route auth", () => {
  test("GET / requires authentication", async () => {
    const { app } = await setup();
    const res = await app.request("/pain");
    expect(res.status).toBe(401);
  });

  test("POST / requires authentication", async () => {
    const { app } = await setup();
    const res = await app.request("/pain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(401);
  });

  test("GET /options requires authentication", async () => {
    const { app } = await setup();
    const res = await app.request("/pain/options");
    expect(res.status).toBe(401);
  });
});

describe("POST /pain", () => {
  test("creates entry with valid body and returns id 201", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/pain", {
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
    const res = await app.request("/pain", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ ...validBody, entryDate: "" }),
    });
    expect(res.status).toBe(400);
  });

  test("rejects painLevel out of range (>9) with 400", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/pain", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ ...validBody, painLevel: 10 }),
    });
    expect(res.status).toBe(400);
  });

  test("accepts tag arrays via tags object", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/pain", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        ...validBody,
        area: undefined,
        symptoms: undefined,
        tags: { area: ["back", "neck"], symptoms: ["ache"] },
      }),
    });
    expect(res.status).toBe(201);
  });
});

describe("GET /pain", () => {
  test("returns empty array when no entries", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/pain", { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  test("returns entries with full shape", async () => {
    const { app, cookie } = await setup();
    await app.request("/pain", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    const res = await app.request("/pain", { headers: { cookie } });
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].painLevel).toBe(5);
    expect(body.data[0].area).toBe("back");
    expect(body.data[0].note).toBe("Test pain entry");
  });

  test("isolates entries across users (IDOR check)", async () => {
    const { ctx, app, cookie } = await setup();
    await app.request("/pain", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    await seedUser(ctx.db, { email: "other@example.com" });
    const otherCookie = sessionCookieFor(ctx.db, "other@example.com");
    const res = await app.request("/pain", { headers: { cookie: otherCookie } });
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});

describe("PUT /pain/:id", () => {
  test("updates entry and returns ok", async () => {
    const { app, cookie } = await setup();
    const created = await app.request("/pain", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    const { data } = await created.json();
    const res = await app.request(`/pain/${data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ ...validBody, note: "updated" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.ok).toBe(true);
  });

  test("returns 404 for non-existent id", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/pain/99999", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(404);
  });

  test("returns 400 for non-numeric id (PR #82 regression)", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/pain/abc", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(400);
  });

  test("cannot update another user's entry (IDOR)", async () => {
    const { ctx, app, cookie } = await setup();
    const created = await app.request("/pain", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    const { data } = await created.json();
    await seedUser(ctx.db, { email: "other@example.com" });
    const otherCookie = sessionCookieFor(ctx.db, "other@example.com");
    const res = await app.request(`/pain/${data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: otherCookie },
      body: JSON.stringify({ ...validBody, note: "hacker" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /pain/:id", () => {
  test("deletes entry and returns ok", async () => {
    const { app, cookie } = await setup();
    const created = await app.request("/pain", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    const { data } = await created.json();
    const res = await app.request(`/pain/${data.id}`, { method: "DELETE", headers: { cookie } });
    expect(res.status).toBe(200);
    const list = await app.request("/pain", { headers: { cookie } });
    const listBody = await list.json();
    expect(listBody.data).toEqual([]);
  });

  test("returns 404 for non-existent id", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/pain/99999", { method: "DELETE", headers: { cookie } });
    expect(res.status).toBe(404);
  });

  test("returns 400 for non-numeric id (PR #82 regression)", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/pain/abc", { method: "DELETE", headers: { cookie } });
    expect(res.status).toBe(400);
  });

  test("cannot delete another user's entry (IDOR)", async () => {
    const { ctx, app, cookie } = await setup();
    const created = await app.request("/pain", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(validBody),
    });
    const { data } = await created.json();
    await seedUser(ctx.db, { email: "other@example.com" });
    const otherCookie = sessionCookieFor(ctx.db, "other@example.com");
    const res = await app.request(`/pain/${data.id}`, {
      method: "DELETE",
      headers: { cookie: otherCookie },
    });
    expect(res.status).toBe(404);
  });
});

describe("pain options routes", () => {
  test("GET /options returns empty arrays for new user", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/pain/options", { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({
      area: [],
      symptoms: [],
      activities: [],
      medicines: [],
      habits: [],
      other: [],
      preselectedMedicines: [],
    });
  });

  test("POST /options/restore adds value, GET reflects, /remove removes", async () => {
    const { app, cookie } = await setup();
    const restore = await app.request("/pain/options/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ field: "area", value: "back" }),
    });
    expect(restore.status).toBe(200);
    let opts = await (await app.request("/pain/options", { headers: { cookie } })).json();
    expect(opts.data.area).toEqual(["back"]);

    const remove = await app.request("/pain/options/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ field: "area", value: "back" }),
    });
    expect(remove.status).toBe(200);
    opts = await (await app.request("/pain/options", { headers: { cookie } })).json();
    expect(opts.data.area).toEqual([]);
  });

  test("POST /options/restore rejects unknown field 400", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/pain/options/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ field: "not_a_field", value: "x" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_FIELD");
  });

  test("POST /options/restore rejects empty value 400", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/pain/options/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ field: "area", value: "   " }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_VALUE");
  });

  test("restored medicine is preselected by default", async () => {
    const { app, cookie } = await setup();
    await app.request("/pain/options/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ field: "medicines", value: "200mg celebrex" }),
    });
    const opts = await (await app.request("/pain/options", { headers: { cookie } })).json();
    expect(opts.data.medicines).toEqual(["200mg celebrex"]);
    expect(opts.data.preselectedMedicines).toEqual(["200mg celebrex"]);
  });

  test("POST /options/preselect toggles preselection, GET reflects", async () => {
    const { app, cookie } = await setup();
    await app.request("/pain/options/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ field: "medicines", value: "4mg sirdalud" }),
    });

    const off = await app.request("/pain/options/preselect", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ field: "medicines", value: "4mg sirdalud", preselected: false }),
    });
    expect(off.status).toBe(200);
    let opts = await (await app.request("/pain/options", { headers: { cookie } })).json();
    expect(opts.data.medicines).toEqual(["4mg sirdalud"]);
    expect(opts.data.preselectedMedicines).toEqual([]);

    const on = await app.request("/pain/options/preselect", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ field: "medicines", value: "4mg sirdalud", preselected: true }),
    });
    expect(on.status).toBe(200);
    opts = await (await app.request("/pain/options", { headers: { cookie } })).json();
    expect(opts.data.preselectedMedicines).toEqual(["4mg sirdalud"]);
  });

  test("POST /options/preselect rejects unknown field 400", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/pain/options/preselect", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ field: "not_a_field", value: "x", preselected: true }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_FIELD");
  });

  test("POST /options/preselect rejects non-medicines field 400", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/pain/options/preselect", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ field: "area", value: "back", preselected: true }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_FIELD");
  });
});
