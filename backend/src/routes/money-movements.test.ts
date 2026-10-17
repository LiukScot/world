import { describe, expect, test } from "bun:test";
import movementsRoute from "./money-movements.ts";
import { setupAuthedApp } from "../test-helpers.ts";

const VALID = { name: "Rent", direction: "expense", amount: 850, note: "" };

async function setup() {
  return setupAuthedApp([
    { path: "/movements", route: movementsRoute },
  ]);
}

function post(app: Awaited<ReturnType<typeof setup>>["app"], cookie: string, body: object) {
  return app.request("/movements", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

describe("money monthly movements", () => {
  test("requires authentication", async () => {
    const { app } = await setup();
    expect((await app.request("/movements")).status).toBe(401);
  });

  test("round-trips a movement and lists it by descending amount", async () => {
    const { app, cookie } = await setup();
    expect((await post(app, cookie, { ...VALID, name: "Salary", direction: "income", amount: 2000 })).status).toBe(201);
    expect((await post(app, cookie, VALID)).status).toBe(201);

    const list = await (await app.request("/movements", { headers: { cookie } })).json();
    expect(list.data.map((m: { name: string }) => m.name)).toEqual(["Salary", "Rent"]);
    expect(list.data[0]).toMatchObject({ direction: "income", amount: 2000 });
  });

  test("rejects an unknown direction and a negative amount", async () => {
    const { app, cookie } = await setup();
    expect((await post(app, cookie, { ...VALID, direction: "sideways" })).status).toBe(400);
    expect((await post(app, cookie, { ...VALID, amount: -1 })).status).toBe(400);
  });

  test("stores an annual cadence and defaults to monthly when it is omitted", async () => {
    const { app, cookie } = await setup();
    expect((await post(app, cookie, { ...VALID, name: "Insurance", cadence: "annual" })).status).toBe(201);
    expect((await post(app, cookie, { ...VALID, name: "Rent", amount: 1 })).status).toBe(201);

    const list = await (await app.request("/movements", { headers: { cookie } })).json();
    const byName = Object.fromEntries(list.data.map((m: { name: string; cadence: string }) => [m.name, m.cadence]));
    expect(byName).toEqual({ Insurance: "annual", Rent: "monthly" });
  });

  test("rejects an unknown cadence", async () => {
    const { app, cookie } = await setup();
    expect((await post(app, cookie, { ...VALID, cadence: "weekly" })).status).toBe(400);
  });

  test("updates the cadence of an existing movement", async () => {
    const { app, cookie } = await setup();
    const { data } = await (await post(app, cookie, VALID)).json();

    const put = await app.request(`/movements/${data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ ...VALID, cadence: "annual" }),
    });
    expect(put.status).toBe(200);
    const list = await (await app.request("/movements", { headers: { cookie } })).json();
    expect(list.data[0].cadence).toBe("annual");
  });

  test("updates and deletes", async () => {
    const { app, cookie } = await setup();
    const { data } = await (await post(app, cookie, VALID)).json();

    const put = await app.request(`/movements/${data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ ...VALID, amount: 900 }),
    });
    expect(put.status).toBe(200);
    let list = await (await app.request("/movements", { headers: { cookie } })).json();
    expect(list.data[0].amount).toBe(900);

    expect((await app.request(`/movements/${data.id}`, { method: "DELETE", headers: { cookie } })).status).toBe(200);
    list = await (await app.request("/movements", { headers: { cookie } })).json();
    expect(list.data).toHaveLength(0);
  });

  test("404s on an unknown id", async () => {
    const { app, cookie } = await setup();
    expect((await app.request("/movements/mm-nope", { method: "DELETE", headers: { cookie } })).status).toBe(404);
  });
});
