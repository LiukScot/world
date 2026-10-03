import { describe, expect, test } from "bun:test";
import authRoute from "./auth.ts";
import fullBackupRoute from "./full-backup.ts";
import diaryRoute from "./diary.ts";
import transactionsRoute from "./money-transactions.ts";
import { setupAuthedApp } from "../test-helpers.ts";

async function setup() {
  return setupAuthedApp([
    { path: "/auth", route: authRoute },
    { path: "/full-backup", route: fullBackupRoute },
    { path: "/diary", route: diaryRoute },
    { path: "/money/transactions", route: transactionsRoute },
  ]);
}

type App = Awaited<ReturnType<typeof setup>>["app"];

const json = (cookie: string, body: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json", cookie },
  body: JSON.stringify(body),
});

async function seed(app: App, cookie: string, label: string) {
  await app.request("/diary", json(cookie, { entryDate: "2026-05-16", entryTime: "21:00", moodLevel: 6, description: label }));
  await app.request("/money/transactions", json(cookie, { txDate: "2026-02-01", asset: label, tipo: "nuovo vincolo", buyValue: 500, pnl: 10 }));
}

async function counts(app: App, cookie: string) {
  const diary = (await (await app.request("/diary", { headers: { cookie } })).json()).data;
  const money = (await (await app.request("/money/transactions", { headers: { cookie } })).json()).data;
  return { diary: JSON.stringify(diary), money: (money as Array<{ asset: string }>).map((t) => t.asset) };
}

describe("full backup", () => {
  test("requires authentication", async () => {
    const { app } = await setup();
    expect((await app.request("/full-backup/json")).status).toBe(401);
    expect((await app.request("/full-backup/xlsx/import", { method: "POST" })).status).toBe(401);
  });

  test("a JSON export carries both realms and restores them", async () => {
    const { app, cookie } = await setup();
    await seed(app, cookie, "BACKED-UP");
    const exported = (await (await app.request("/full-backup/json", { headers: { cookie } })).json()).data;
    expect(Object.keys(exported).sort()).toEqual(["health", "money"]);

    await seed(app, cookie, "LATER");
    expect((await app.request("/full-backup/json/import", json(cookie, exported))).status).toBe(200);
    const after = await counts(app, cookie);
    expect(after.money).toEqual(["BACKED-UP"]);
    expect(after.diary).toContain("BACKED-UP");
    expect(after.diary).not.toContain("LATER");
  });

  test("a section the file lacks is left untouched", async () => {
    const { app, cookie } = await setup();
    await seed(app, cookie, "KEPT");
    const exported = (await (await app.request("/full-backup/json", { headers: { cookie } })).json()).data;
    expect((await app.request("/full-backup/json/import", json(cookie, { money: { ...exported.money, transactions: [] } }))).status).toBe(200);
    const after = await counts(app, cookie);
    expect(after.money).toEqual([]);
    expect(after.diary).toContain("KEPT");
  });

  test("a failing part rolls back the whole import", async () => {
    const { app, cookie } = await setup();
    await seed(app, cookie, "ORIGINAL");
    const before = await counts(app, cookie);
    const broken = { health: { diary: { rows: [{ date: "not a date", description: "x" }] } }, money: { transactions: [] } };
    expect((await app.request("/full-backup/json/import", json(cookie, broken))).status).toBe(422);
    expect(await counts(app, cookie)).toEqual(before);
  });

  test("rejects a file with neither section", async () => {
    const { app, cookie } = await setup();
    expect((await app.request("/full-backup/json/import", json(cookie, { transactions: [] }))).status).toBe(400);
  });

  test("an XLSX export carries both realms and restores them", async () => {
    const { app, cookie } = await setup();
    await seed(app, cookie, "SHEET");
    const res = await app.request("/full-backup/xlsx", { headers: { cookie } });
    expect(res.status).toBe(200);
    const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");

    await seed(app, cookie, "LATER");
    expect((await app.request("/full-backup/xlsx/import", json(cookie, { base64 }))).status).toBe(200);
    const after = await counts(app, cookie);
    expect(after.money).toEqual(["SHEET"]);
    expect(after.diary).toContain("SHEET");
    expect(after.diary).not.toContain("LATER");
  });
});
