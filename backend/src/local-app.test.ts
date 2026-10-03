import { describe, expect, test } from "bun:test";
import initSqlJs from "sql.js";
import { Hono } from "hono";
import { createLocalApp } from "./local-app.ts";
import { mountApiRoutes } from "./api.ts";
import type { AppEnv } from "./app-env.ts";
import { createTestDb, seedUser } from "./test-helpers.ts";

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

// The server runs the same routes on bun:sqlite; this builds it signed in.
async function createServerApp(): Promise<{ fetch(request: Request): Promise<Response> }> {
  const ctx = createTestDb();
  const user = await seedUser(ctx.db);
  const app = new Hono<AppEnv>();
  app.use("/api/*", async (c, next) => {
    c.set("db", ctx.db);
    c.set("rawDb", ctx.rawDb);
    c.set("userId", user.id);
    c.set("userEmail", user.email);
    await next();
  });
  mountApiRoutes(app);
  return { fetch: async (req) => app.fetch(req) };
}

async function exportJson(app: { fetch(request: Request): Promise<Response> }, path: string): Promise<unknown> {
  const res = await app.fetch(request(path));
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: unknown }).data;
}

type Dump = Record<string, unknown>;

async function seededServerExport(path: string): Promise<Dump> {
  const server = await createServerApp();
  await server.fetch(post("/api/v1/diary", diaryEntry));
  await server.fetch(
    post("/api/v1/pain", { entryDate: "2026-05-16", entryTime: "09:00", painLevel: 5, area: "back", note: "server pain" }),
  );
  await server.fetch(post("/api/v1/cbt", { entryDate: "2026-05-16", entryTime: "10:00", situation: "server cbt" }));
  await server.fetch(post("/api/v1/dbt", { entryDate: "2026-05-16", entryTime: "11:00", emotionName: "server dbt" }));
  await server.fetch(post("/api/v1/memorable-days", { date: "2026-05-18", title: "server day" }));
  await server.fetch(
    post("/api/v1/money/transactions", { txDate: "2026-02-01", asset: "ETF-A", tipo: "nuovo vincolo", buyValue: 500, pnl: 10 }),
  );
  return (await exportJson(server, path)) as Dump;
}

// Imports a dump into a new device, restarts it from the saved file, and
// exports again.
async function restoreOnDevice(path: string, dump: Dump): Promise<Dump> {
  const device = createLocalApp(new SQL.Database());
  const imported = await device.fetch(post(`${path}/import`, dump));
  expect(imported.status).toBe(200);
  const restarted = createLocalApp(new SQL.Database(device.exportDatabase()));
  return (await exportJson(restarted, path)) as Dump;
}

describe("server export restores on the device", () => {
  test("Health entries come back unchanged", async () => {
    const path = "/api/v1/backup/json";
    const fromServer = await seededServerExport(path);
    const restored = await restoreOnDevice(path, fromServer);

    const rows = (dump: Dump, sheet: string) => (dump[sheet] as { rows: unknown[] }).rows;
    for (const sheet of ["diary", "pain"]) {
      expect(rows(fromServer, sheet)).toHaveLength(1);
      expect(rows(restored, sheet)).toEqual(rows(fromServer, sheet));
    }
    for (const section of ["cbt", "dbt", "memorableDays"]) {
      expect(fromServer[section]).toHaveLength(1);
      expect(restored[section]).toEqual(fromServer[section]);
    }
  });

  test("Money transactions come back unchanged apart from their ids", async () => {
    const path = "/api/v1/money/backup/json";
    const fromServer = await seededServerExport(path);
    const restored = await restoreOnDevice(path, fromServer);

    // The import gives every transaction a new id.
    const withoutIds = (dump: Dump) =>
      (dump.transactions as Array<Record<string, unknown>>).map(({ id: _id, ...rest }) => rest);
    expect(withoutIds(fromServer)).toHaveLength(1);
    expect(withoutIds(restored)).toEqual(withoutIds(fromServer));
  });
});

describe("WebDAV backup settings", () => {
  const settings = { url: "https://dav.example.com/remote.php/dav", folder: "world", username: "me", enabled: true };

  function put(app: ReturnType<typeof createLocalApp>, body: unknown) {
    return app.fetch(request("/api/v1/webdav-backup", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  }

  async function read(app: ReturnType<typeof createLocalApp>) {
    const res = await app.fetch(request("/api/v1/webdav-backup"));
    return ((await res.json()) as { data: Record<string, unknown> }).data;
  }

  test("are saved, recorded and kept in an exported database", async () => {
    const first = createLocalApp(new SQL.Database());
    expect((await put(first, settings)).status).toBe(200);
    await first.fetch(post("/api/v1/webdav-backup/result", { ok: false, error: "401 Unauthorized" }));
    await first.fetch(post("/api/v1/webdav-backup/result", { ok: true }));

    const restored = await read(createLocalApp(new SQL.Database(first.exportDatabase())));
    expect(restored).toMatchObject({ ...settings, lastError: null });
    expect(restored.lastSuccessAt).toBe(restored.lastAttemptAt);
    expect(typeof restored.lastSuccessAt).toBe("string");
  });

  test("reject a non-http URL and turning on without a URL", async () => {
    const app = createLocalApp(new SQL.Database());
    expect((await put(app, { ...settings, url: "ftp://dav.example.com" })).status).toBe(400);
    expect((await put(app, { ...settings, url: "" })).status).toBe(400);
    expect((await read(app)).enabled).toBe(false);
  });

  test("are not served by the server API", async () => {
    const server = await createServerApp();
    expect((await server.fetch(request("/api/v1/webdav-backup"))).status).toBe(404);
  });
});
