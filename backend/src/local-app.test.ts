import { describe, expect, test } from "bun:test";
import initSqlJs from "sql.js";
import { createLocalApp } from "./local-app.ts";

const SQL = await initSqlJs();

const diaryEntry = {
  entryDate: "2026-10-02",
  entryTime: "21:30",
  moodLevel: 7,
  depressionLevel: 2,
  anxietyLevel: 3,
  description: "written on the device",
  reflection: "",
};

function request(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost${path}`, init);
}

function post(path: string, body: unknown): Request {
  return request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("local app on sql.js", () => {
  test("answers as a signed-in user without a cookie", async () => {
    const app = createLocalApp(new SQL.Database());
    const res = await app.fetch(request("/api/v1/auth/session"));
    const body = (await res.json()) as { data: { authenticated: boolean } };
    expect(body.data.authenticated).toBe(true);
  });

  test("stores an entry and reads it back", async () => {
    const app = createLocalApp(new SQL.Database());

    const created = await app.fetch(post("/api/v1/diary", diaryEntry));
    expect(created.status).toBeLessThan(300);

    const listed = await app.fetch(request("/api/v1/diary"));
    expect(await listed.text()).toContain("written on the device");
  });

  test("an exported database restores with its data and the same user", async () => {
    const first = createLocalApp(new SQL.Database());
    await first.fetch(post("/api/v1/diary", diaryEntry));
    const bytes = first.exportDatabase();

    const second = createLocalApp(new SQL.Database(bytes));
    const listed = await second.fetch(request("/api/v1/diary"));
    expect(await listed.text()).toContain("written on the device");
  });

  test("keeps foreign keys enforced after an export", () => {
    const sqlDb = new SQL.Database();
    const app = createLocalApp(sqlDb);
    app.exportDatabase();

    const insertFor = (userId: number) => () =>
      sqlDb.run("INSERT INTO diary_entries (user_id, entry_date, entry_time) VALUES (?, '2026-10-02', '10:00')", [userId]);

    expect(insertFor(1)).not.toThrow();
    expect(insertFor(9999)).toThrow(/FOREIGN KEY/);
  });

  test("an unknown route is a JSON 404", async () => {
    const app = createLocalApp(new SQL.Database());
    const res = await app.fetch(request("/api/v1/auth/login", { method: "POST" }));
    expect(res.status).toBe(404);
  });
});
