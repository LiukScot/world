import { describe, expect, test } from "bun:test";
import authRoute from "./auth.ts";
import transactionsRoute from "./money-transactions.ts";
import { loginAndGetCookie, seedUser, setupAuthedApp } from "../test-helpers.ts";

const VALID = {
  txDate: "2026-03-14",
  asset: "ETF-World",
  tipo: "nuovo vincolo",
  buyValue: 1000,
  pnl: 50,
  note: "first buy",
};

async function setup() {
  const s = await setupAuthedApp([
    { path: "/auth", route: authRoute },
    { path: "/transactions", route: transactionsRoute },
  ]);
  return { ctx: s.ctx, app: s.app, cookie: s.cookie, user: s.user };
}

async function create(app: Awaited<ReturnType<typeof setup>>["app"], cookie: string, body: object = VALID) {
  const res = await app.request("/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  return { res, body: res.status === 201 ? await res.json() : null };
}

describe("money transactions auth", () => {
  test("every method requires authentication", async () => {
    const { app } = await setup();
    expect((await app.request("/transactions")).status).toBe(401);
    expect((await app.request("/transactions", { method: "POST" })).status).toBe(401);
    expect((await app.request("/transactions/tx-1", { method: "PUT" })).status).toBe(401);
    expect((await app.request("/transactions/tx-1", { method: "DELETE" })).status).toBe(401);
  });
});

describe("money transactions CRUD", () => {
  test("creates and lists a transaction", async () => {
    const { app, cookie } = await setup();
    const created = await create(app, cookie);
    expect(created.res.status).toBe(201);
    expect(created.body.data.id).toStartWith("tx-");

    const list = await (await app.request("/transactions", { headers: { cookie } })).json();
    expect(list.data).toHaveLength(1);
    expect(list.data[0]).toMatchObject({
      txDate: "2026-03-14",
      asset: "ETF-World",
      buyValue: 1000,
      pnl: 50,
      note: "first buy",
    });
  });

  test("derives type and current value when the client omits them", async () => {
    const { app, cookie } = await setup();
    await create(app, cookie);
    const list = await (await app.request("/transactions", { headers: { cookie } })).json();
    // tipo "nuovo vincolo" with a non-negative buyValue means a buy, and the
    // current value defaults to buyValue + pnl.
    expect(list.data[0].derivedType).toBe("buy");
    expect(list.data[0].currentValue).toBe(1050);
  });

  test("keeps a client-supplied derived type and current value", async () => {
    const { app, cookie } = await setup();
    await create(app, cookie, { ...VALID, derivedType: "sell", currentValue: 7 });
    const list = await (await app.request("/transactions", { headers: { cookie } })).json();
    expect(list.data[0].derivedType).toBe("sell");
    expect(list.data[0].currentValue).toBe(7);
  });

  test("updates an existing transaction", async () => {
    const { app, cookie } = await setup();
    const created = await create(app, cookie);
    const res = await app.request(`/transactions/${created.body.data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ ...VALID, asset: "Bond-A", buyValue: 200, pnl: -10 }),
    });
    expect(res.status).toBe(200);
    const list = await (await app.request("/transactions", { headers: { cookie } })).json();
    expect(list.data[0].asset).toBe("Bond-A");
    expect(list.data[0].currentValue).toBe(190);
  });

  test("deletes a transaction", async () => {
    const { app, cookie } = await setup();
    const created = await create(app, cookie);
    const res = await app.request(`/transactions/${created.body.data.id}`, {
      method: "DELETE",
      headers: { cookie },
    });
    expect(res.status).toBe(200);
    const list = await (await app.request("/transactions", { headers: { cookie } })).json();
    expect(list.data).toHaveLength(0);
  });

  test("rejects an invalid calendar date", async () => {
    const { app, cookie } = await setup();
    const { res } = await create(app, cookie, { ...VALID, txDate: "2026-02-30" });
    expect(res.status).toBe(400);
  });

  test("404s on a transaction that is not yours", async () => {
    const { ctx, app, cookie } = await setup();
    const created = await create(app, cookie);
    const other = await seedUser(ctx.db);
    const otherCookie = await (async () => {
      const res = await app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: other.email, password: other.password }),
      });
      return res.headers.get("set-cookie")!.split(";")[0]!;
    })();

    const put = await app.request(`/transactions/${created.body.data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: otherCookie },
      body: JSON.stringify(VALID),
    });
    expect(put.status).toBe(404);

    const del = await app.request(`/transactions/${created.body.data.id}`, {
      method: "DELETE",
      headers: { cookie: otherCookie },
    });
    expect(del.status).toBe(404);

    // The owner still sees it untouched.
    const list = await (await app.request("/transactions", { headers: { cookie } })).json();
    expect(list.data).toHaveLength(1);
  });
});

const IMPORT_ROWS = [
  { txDate: "2026-01-31", asset: "revolut", tipo: "interessi", buyValue: 0, pnl: 2.82, note: "" },
  { txDate: "2026-02-16", asset: "revolut", tipo: "nuovo vincolo", buyValue: 800, pnl: 0, note: "" },
  { txDate: "2026-02-28", asset: "revolut robo-advisor", tipo: "commissione", buyValue: 0, pnl: -0.47, note: "" },
];

async function importRows(
  app: Awaited<ReturnType<typeof setup>>["app"],
  cookie: string,
  body: object,
) {
  const res = await app.request("/transactions/import", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  return { res, body: res.status === 200 ? await res.json() : null };
}

async function listAll(app: Awaited<ReturnType<typeof setup>>["app"], cookie: string) {
  return (await (await app.request("/transactions", { headers: { cookie } })).json()).data;
}

describe("money transactions import", () => {
  test("overlapping robo statements preserve opening gains and reimport without duplication", async () => {
    const { app, cookie } = await setup();
    const asset = "revolut robo-advisor";
    await create(app, cookie, { ...VALID, txDate: "2026-01-10", asset, buyValue: 1000, pnl: 0 });
    await create(app, cookie, {
      ...VALID, txDate: "2026-09-12", asset, tipo: "Variazione Valore", buyValue: 0, pnl: 80,
    });
    const statement = {
      rows: [
        { txDate: "2026-09-15", asset, tipo: "nuovo vincolo", buyValue: 50, pnl: 0, note: "" },
        { txDate: "2026-10-10", asset, tipo: "Variazione Valore", buyValue: 0, pnl: 20, note: "" },
      ],
      replace: { from: "2026-09-01", to: "2026-10-10" },
      roboOpeningBalance: 1100,
    };
    for (let i = 0; i < 2; i++) {
      expect((await importRows(app, cookie, statement)).res.status).toBe(200);
      const rows = await listAll(app, cookie) as Array<{ txDate: string; currentValue: number; pnl: number }>;
      expect(rows.reduce((sum, row) => sum + row.currentValue, 0)).toBe(1170);
      expect(rows.filter((row) => row.txDate < statement.replace.from).reduce((sum, row) => sum + row.currentValue, 0)).toBe(1100);
      expect(rows.find((row) => row.txDate === "2026-10-10")?.pnl).toBe(20);
      expect(rows).toHaveLength(4);
    }
  });

  test.each([
    { opening: 900, total: 970, correction: -100, count: 3 },
    { opening: 1000, total: 1070, correction: 0, count: 2 },
  ])("reconciles opening balance $opening without inventing an extra gain", async ({ opening, total, correction, count }) => {
    const { app, cookie } = await setup();
    const asset = "revolut robo-advisor";
    await create(app, cookie, { ...VALID, txDate: "2026-01-10", asset, buyValue: 1000, pnl: 0 });
    const imported = await importRows(app, cookie, {
      rows: [{ txDate: "2026-10-10", asset, tipo: "Variazione Valore", buyValue: 0, pnl: 70 }],
      replace: { from: "2026-09-01", to: "2026-10-10" },
      roboOpeningBalance: opening,
    });
    expect(imported.res.status).toBe(200);
    const rows = await listAll(app, cookie) as Array<{ txDate: string; currentValue: number; pnl: number }>;
    expect(rows.reduce((sum, row) => sum + row.currentValue, 0)).toBe(total);
    expect(rows).toHaveLength(count);
    if (correction !== 0) expect(rows.find((row) => row.txDate === "2026-08-31")?.pnl).toBe(correction);
  });

  test("refuses a nonzero robo opening balance without earlier history before deleting anything", async () => {
    const { app, cookie } = await setup();
    const asset = "revolut robo-advisor";
    await create(app, cookie, { ...VALID, txDate: "2026-09-12", asset, buyValue: 50, pnl: 0 });
    const before = await listAll(app, cookie);
    const imported = await importRows(app, cookie, {
      rows: [{ txDate: "2026-10-10", asset, tipo: "Variazione Valore", buyValue: 0, pnl: 70 }],
      replace: { from: "2026-09-01", to: "2026-10-10" },
      roboOpeningBalance: 1000,
    });
    expect(imported.res.status).toBe(400);
    expect(await listAll(app, cookie)).toEqual(before);
  });

  test("preserves earlier gains when the new statement has no market revaluation", async () => {
    const { app, cookie } = await setup();
    const asset = "revolut robo-advisor";
    await create(app, cookie, { ...VALID, txDate: "2026-01-10", asset, buyValue: 1000, pnl: 0 });
    await create(app, cookie, { ...VALID, txDate: "2026-09-12", asset, tipo: "Variazione Valore", buyValue: 0, pnl: 100 });
    const imported = await importRows(app, cookie, {
      rows: [{ txDate: "2026-09-15", asset, tipo: "nuovo vincolo", buyValue: 50, pnl: 0 }],
      replace: { from: "2026-09-01", to: "2026-10-10" },
      roboOpeningBalance: 1100,
    });
    expect(imported.res.status).toBe(200);
    const rows = await listAll(app, cookie) as Array<{ currentValue: number }>;
    expect(rows.reduce((sum, row) => sum + row.currentValue, 0)).toBe(1150);
  });

  test("refuses opening balance reconciliation for another asset or without replacement", async () => {
    const { app, cookie } = await setup();
    for (const body of [
      { rows: IMPORT_ROWS, replace: { from: "2026-01-01", to: "2026-02-28" }, roboOpeningBalance: 100 },
      { rows: [{ ...IMPORT_ROWS[2], tipo: "Variazione Valore" }], roboOpeningBalance: 100 },
      { rows: [{ ...IMPORT_ROWS[2], tipo: "Variazione Valore" }], replace: { from: "2026-01-01", to: "2026-02-28" }, roboOpeningBalance: -1 },
    ]) {
      expect((await importRows(app, cookie, body)).res.status).toBe(400);
    }
    expect(await listAll(app, cookie)).toHaveLength(0);
  });

  test("requires authentication", async () => {
    const { app } = await setup();
    expect((await app.request("/transactions/import", { method: "POST" })).status).toBe(401);
  });

  test("inserts the rows and derives their type", async () => {
    const { app, cookie } = await setup();
    const imported = await importRows(app, cookie, { rows: IMPORT_ROWS });
    expect(imported.res.status).toBe(200);
    expect(imported.body.data).toEqual({ inserted: 3, skipped: 0, deleted: 0 });

    const rows = await listAll(app, cookie);
    expect(rows).toHaveLength(3);
    expect(rows.find((r: { tipo: string }) => r.tipo === "commissione")).toMatchObject({
      derivedType: "fee",
      currentValue: -0.47,
    });
  });

  test("importing the same statement twice inserts nothing", async () => {
    const { app, cookie } = await setup();
    await importRows(app, cookie, { rows: IMPORT_ROWS });
    const again = await importRows(app, cookie, { rows: IMPORT_ROWS });
    expect(again.body.data).toEqual({ inserted: 0, skipped: 3, deleted: 0 });
    expect(await listAll(app, cookie)).toHaveLength(3);
  });

  test("a row repeated inside one file is inserted once", async () => {
    const { app, cookie } = await setup();
    const imported = await importRows(app, cookie, { rows: [IMPORT_ROWS[0], IMPORT_ROWS[0]] });
    expect(imported.body.data).toMatchObject({ inserted: 1, skipped: 1 });
  });

  test("replacement clears only the named assets inside the period", async () => {
    const { app, cookie } = await setup();
    await create(app, cookie, { ...VALID, txDate: "2026-02-10", asset: "revolut", tipo: "interessi", pnl: 9 });
    await create(app, cookie, { ...VALID, txDate: "2026-02-10", asset: "cherrybank", tipo: "interessi", pnl: 9 });
    await create(app, cookie, { ...VALID, txDate: "2026-05-10", asset: "revolut", tipo: "interessi", pnl: 9 });

    const imported = await importRows(app, cookie, {
      rows: IMPORT_ROWS,
      replace: { from: "2026-01-01", to: "2026-02-28" },
    });
    expect(imported.body.data).toEqual({ inserted: 3, skipped: 0, deleted: 1 });

    const assets = (await listAll(app, cookie)).map((r: { asset: string }) => r.asset);
    expect(assets.filter((a: string) => a === "cherrybank")).toHaveLength(1);
    expect(assets.filter((a: string) => a === "revolut")).toHaveLength(3);
  });

  test("replacement never reaches an asset the statement does not carry", async () => {
    const { app, cookie } = await setup();
    await create(app, cookie, { ...VALID, txDate: "2026-02-10", asset: "cherrybank", tipo: "interessi", pnl: 9 });
    const onlyDeposit = [IMPORT_ROWS[0], IMPORT_ROWS[1]];

    const imported = await importRows(app, cookie, {
      rows: onlyDeposit,
      replace: { from: "2026-01-01", to: "2026-12-31" },
    });
    expect(imported.body.data.deleted).toBe(0);
    expect((await listAll(app, cookie)).some((r: { asset: string }) => r.asset === "cherrybank")).toBe(true);
  });

  test("rejects an import that carries no rows", async () => {
    const { app, cookie } = await setup();
    await create(app, cookie, { ...VALID, txDate: "2026-02-10", asset: "revolut" });
    const empty = await importRows(app, cookie, {
      rows: [],
      replace: { from: "2026-01-01", to: "2026-12-31" },
    });
    expect(empty.res.status).toBe(400);
    expect(await listAll(app, cookie)).toHaveLength(1);
  });

  test("rejects a period that ends before it starts", async () => {
    const { app, cookie } = await setup();
    const bad = await importRows(app, cookie, {
      rows: IMPORT_ROWS,
      replace: { from: "2026-03-01", to: "2026-02-01" },
    });
    expect(bad.res.status).toBe(400);
    expect(await listAll(app, cookie)).toHaveLength(0);
  });

  test("rejects a row that falls outside the period it replaces", async () => {
    // A row written outside the window it replaced is a row the next import of
    // the same statement cannot clear, which is how stale rows survive.
    const { app, cookie } = await setup();
    const bad = await importRows(app, cookie, {
      rows: IMPORT_ROWS,
      replace: { from: "2026-02-01", to: "2026-02-28" },
    });
    expect(bad.res.status).toBe(400);
    expect(await listAll(app, cookie)).toHaveLength(0);
  });

  test("rejects a malformed row without importing the rest", async () => {
    const { app, cookie } = await setup();
    const bad = await importRows(app, cookie, {
      rows: [IMPORT_ROWS[0], { ...IMPORT_ROWS[1], txDate: "2026-02-31" }],
    });
    expect(bad.res.status).toBe(400);
    expect(await listAll(app, cookie)).toHaveLength(0);
  });

  test("one user's rows never collide with another's", async () => {
    const { app, cookie, ctx } = await setup();
    await importRows(app, cookie, { rows: IMPORT_ROWS });
    const other = await seedUser(ctx.db, { email: "other@example.com" });
    const otherCookie = await loginAndGetCookie(app, "/auth", other.email, other.password);
    const mine = await importRows(app, otherCookie, { rows: IMPORT_ROWS });
    expect(mine.body.data).toMatchObject({ inserted: 3, skipped: 0 });
  });
});
