import { describe, expect, test } from "bun:test";
import cbtRoute from "../routes/cbt.ts";
import transactionsRoute from "../routes/money-transactions.ts";
import { setupAuthedApp } from "../test-helpers.ts";

/**
 * created_at/updated_at must be filled by SQLite, not by a JS-side default.
 * Declaring them as .default("CURRENT_TIMESTAMP") in the Drizzle schema makes
 * Drizzle send that string as a value, so the column ends up holding the
 * literal text "CURRENT_TIMESTAMP" and the SQL default never runs. Every table
 * in this schema had that bug; this pins the fix across both realms.
 */
const SQLITE_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

describe("row timestamps are real", () => {
  test("a money transaction gets a SQLite timestamp", async () => {
    const { app, cookie } = await setupAuthedApp([
      { path: "/transactions", route: transactionsRoute },
    ]);
    await app.request("/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ txDate: "2026-03-14", asset: "A", tipo: "cedola", pnl: 1 }),
    });

    const list = await (await app.request("/transactions", { headers: { cookie } })).json();
    expect(list.data[0].createdAt).toMatch(SQLITE_TIMESTAMP);
    expect(list.data[0].updatedAt).toMatch(SQLITE_TIMESTAMP);
  });

  test("a health entry gets one too", async () => {
    const { app, cookie } = await setupAuthedApp([
      { path: "/cbt", route: cbtRoute },
    ]);
    await app.request("/cbt", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ entryDate: "2026-03-14", entryTime: "10:00", situation: "s" }),
    });

    const list = await (await app.request("/cbt", { headers: { cookie } })).json();
    expect(list.data[0].createdAt).toMatch(SQLITE_TIMESTAMP);
  });
});
