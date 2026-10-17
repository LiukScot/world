import { describe, expect, test } from "bun:test";
import snapshotsRoute from "./money-snapshots.ts";
import { setupAuthedApp } from "../test-helpers.ts";

const VALID = { snapshotDate: "2026-01-31", lowRisk: 100, mediumRisk: 200, highRisk: 300, liquid: 400 };

async function setup() {
  return setupAuthedApp([
    { path: "/snapshots", route: snapshotsRoute },
  ]);
}

function post(app: Awaited<ReturnType<typeof setup>>["app"], cookie: string, body: object) {
  return app.request("/snapshots", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

describe("money monthly snapshots", () => {
  test("requires authentication", async () => {
    const { app } = await setup();
    expect((await app.request("/snapshots")).status).toBe(401);
  });

  test("lists newest first", async () => {
    const { app, cookie } = await setup();
    await post(app, cookie, VALID);
    await post(app, cookie, { ...VALID, snapshotDate: "2026-02-28" });

    const list = await (await app.request("/snapshots", { headers: { cookie } })).json();
    expect(list.data.map((s: { snapshotDate: string }) => s.snapshotDate)).toEqual(["2026-02-28", "2026-01-31"]);
  });

  test("defaults every bucket to zero", async () => {
    const { app, cookie } = await setup();
    expect((await post(app, cookie, { snapshotDate: "2026-04-30" })).status).toBe(201);
    const list = await (await app.request("/snapshots", { headers: { cookie } })).json();
    expect(list.data[0]).toMatchObject({ lowRisk: 0, mediumRisk: 0, highRisk: 0, liquid: 0 });
  });

  test("rejects a date that is not a real day", async () => {
    const { app, cookie } = await setup();
    expect((await post(app, cookie, { ...VALID, snapshotDate: "2026-11-31" })).status).toBe(400);
  });

  test("updates and deletes", async () => {
    const { app, cookie } = await setup();
    const { data } = await (await post(app, cookie, VALID)).json();

    const put = await app.request(`/snapshots/${data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ ...VALID, liquid: 999 }),
    });
    expect(put.status).toBe(200);
    let list = await (await app.request("/snapshots", { headers: { cookie } })).json();
    expect(list.data[0].liquid).toBe(999);

    expect((await app.request(`/snapshots/${data.id}`, { method: "DELETE", headers: { cookie } })).status).toBe(200);
    list = await (await app.request("/snapshots", { headers: { cookie } })).json();
    expect(list.data).toHaveLength(0);
  });
});
