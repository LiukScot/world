import { describe, expect, test } from "bun:test";
import authRoute from "./auth.ts";
import backupRoute from "./backup.ts";
import diaryRoute from "./diary.ts";
import painRoute from "./pain.ts";
import moodRoute from "./mood.ts";
import { extractSessionCookie, seedUser, setupAuthedApp } from "../test-helpers.ts";
import type { SQLiteDB } from "../db.ts";

async function setup() {
  const s = await setupAuthedApp([
    { path: "/auth", route: authRoute },
    { path: "/backup", route: backupRoute },
    { path: "/data", route: backupRoute },
    { path: "/diary", route: diaryRoute },
    { path: "/pain", route: painRoute },
    { path: "/mood", route: moodRoute },
  ]);
  return { ctx: s.ctx, app: s.app, cookie: s.cookie, userId: s.user.id };
}

const diaryBody = {
  entryDate: "2026-05-16",
  entryTime: "08:30",
  moodLevel: 7,
  depressionLevel: 2,
  anxietyLevel: 3,
  positiveMoods: "happy",
  negativeMoods: "",
  generalMoods: "calm",
  description: "Test entry",
  gratitude: "grateful",
};

const painBody = {
  entryDate: "2026-05-16",
  entryTime: "09:00",
  painLevel: 5,
  fatigueLevel: 4,
  coffeeCount: 2,
  area: "back",
  symptoms: "ache",
  activities: "walking",
  medicines: "",
  habits: "",
  other: "",
  note: "Test pain",
};

describe("backup auth", () => {
  test("GET /json requires authentication", async () => {
    const { app } = await setup();
    const res = await app.request("/backup/json");
    expect(res.status).toBe(401);
  });

  test("POST /json/import requires authentication", async () => {
    const { app } = await setup();
    const res = await app.request("/backup/json/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  test("GET /xlsx requires authentication", async () => {
    const { app } = await setup();
    const res = await app.request("/backup/xlsx");
    expect(res.status).toBe(401);
  });

  test("POST /xlsx/import requires authentication", async () => {
    const { app } = await setup();
    const res = await app.request("/backup/xlsx/import", { method: "POST" });
    expect(res.status).toBe(401);
  });
});

describe("GET /backup/json", () => {
  test("returns empty backup envelope when no data", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/backup/json", { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.diary.rows).toEqual([]);
    expect(body.data.pain.rows).toEqual([]);
    expect(body.data.prefs).toBeDefined();
  });

  test("round-trips diary + pain rows back into export shape", async () => {
    const { app, cookie } = await setup();
    await app.request("/diary", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(diaryBody),
    });
    await app.request("/pain", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(painBody),
    });
    const res = await app.request("/backup/json", { headers: { cookie } });
    const body = await res.json();
    expect(body.data.diary.rows).toHaveLength(1);
    expect(body.data.pain.rows).toHaveLength(1);
    expect(body.data.diary.rows[0].date).toBe("2026-05-16");
    expect(body.data.pain.rows[0].date).toBe("2026-05-16");
  });
});

describe("POST /backup/json/import", () => {
  test("rejects malformed JSON with 400", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/backup/json/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: "{ this is not json",
    });
    expect(res.status).toBe(400);
  });

  test("imports valid JSON payload (empty)", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/backup/json/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
  });

  test("replaces existing diary/pain rows on import", async () => {
    const { app, cookie } = await setup();
    await app.request("/diary", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(diaryBody),
    });
    const res = await app.request("/backup/json/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ diary: { rows: [] }, pain: { rows: [] } }),
    });
    expect(res.status).toBe(200);
    const list = await (await app.request("/diary", { headers: { cookie } })).json();
    expect(list.data).toEqual([]);
  });
});

describe("backup medicine preselection round-trip", () => {
  async function restoreMedicine(app: Awaited<ReturnType<typeof setup>>["app"], cookie: string, value: string) {
    await app.request("/pain/options/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ field: "medicines", value }),
    });
  }

  test("export includes preselectedMedicines reflecting current state", async () => {
    const { app, cookie } = await setup();
    await restoreMedicine(app, cookie, "200mg celebrex");
    await restoreMedicine(app, cookie, "4mg sirdalud");
    // Turn one off so the export must distinguish preselected from the full list.
    await app.request("/pain/options/preselect", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ field: "medicines", value: "4mg sirdalud", preselected: false }),
    });

    const body = await (await app.request("/backup/json", { headers: { cookie } })).json();
    expect(body.data.pain.options.options.medicines).toEqual(["200mg celebrex", "4mg sirdalud"]);
    expect(body.data.pain.options.preselectedMedicines).toEqual(["200mg celebrex"]);
  });

  test("import restores options list and preselection", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/backup/json/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        pain: {
          rows: [],
          options: {
            options: { medicines: ["aspirin", "ibuprofen", "paracetamol"] },
            preselectedMedicines: ["ibuprofen"],
          },
        },
      }),
    });
    expect(res.status).toBe(200);

    const opts = await (await app.request("/pain/options", { headers: { cookie } })).json();
    expect(opts.data.medicines).toEqual(["aspirin", "ibuprofen", "paracetamol"]);
    expect(opts.data.preselectedMedicines).toEqual(["ibuprofen"]);
  });

  test("legacy import without preselectedMedicines defaults medicines to preselected", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/backup/json/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        pain: { rows: [], options: { options: { medicines: ["aspirin", "ibuprofen"] } } },
      }),
    });
    expect(res.status).toBe(200);

    const opts = await (await app.request("/pain/options", { headers: { cookie } })).json();
    expect(opts.data.preselectedMedicines).toEqual(["aspirin", "ibuprofen"]);
  });
});

describe("POST /backup/xlsx/import", () => {
  test("rejects multipart without 'file' field with 400", async () => {
    const { app, cookie } = await setup();
    const form = new FormData();
    form.append("nope", "x");
    const res = await app.request("/backup/xlsx/import", {
      method: "POST",
      headers: { cookie },
      body: form,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("MISSING_FILE");
  });

  test("rejects XLSX upload larger than 10 MB with 413 (PR #82 regression)", async () => {
    const { app, cookie } = await setup();
    const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
    const file = new File([oversized], "big.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const form = new FormData();
    form.append("file", file);
    const res = await app.request("/backup/xlsx/import", {
      method: "POST",
      headers: { cookie },
      body: form,
    });
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error.code).toBe("FILE_TOO_LARGE");
  });

  test("rejects base64 payload larger than 10 MB with 413 (PR #82 regression)", async () => {
    const { app, cookie } = await setup();
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1).toString("base64");
    const res = await app.request("/backup/xlsx/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ base64: oversized }),
    });
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error.code).toBe("FILE_TOO_LARGE");
  });

  test("rejects JSON body without base64 with 400", async () => {
    const { app, cookie } = await setup();
    const res = await app.request("/backup/xlsx/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe("backup data isolation (IDOR)", () => {
  test("user A export does not contain user B data", async () => {
    const { ctx, app, cookie } = await setup();
    await app.request("/diary", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(diaryBody),
    });
    await seedUser(ctx.db, { email: "other@example.com", password: "Password123!" });
    const otherLogin = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "other@example.com", password: "Password123!" }),
    });
    const otherCookie = extractSessionCookie(otherLogin.headers.get("set-cookie"));
    const res = await (
      await app.request("/backup/json", { headers: { cookie: otherCookie } })
    ).json();
    expect(res.data.diary.rows).toEqual([]);
    expect(res.data.pain.rows).toEqual([]);
  });
});

// The purge handler deletes from every user-data table; seed and count all of
// them so a dropped DELETE for any one table is caught, not just diary/pain.
const PURGE_TABLES = [
  "pain_entries",
  "diary_entries",
  "cbt_entries",
  "dbt_entries",
  "memorable_days",
  "user_preferences",
] as const;

function seedAllUserTables(rawDb: SQLiteDB, userId: number): void {
  rawDb.query("INSERT INTO diary_entries (user_id, entry_date, entry_time) VALUES (?, '2026-05-16', '08:00')").run(userId);
  rawDb.query("INSERT INTO pain_entries (user_id, entry_date, entry_time) VALUES (?, '2026-05-16', '09:00')").run(userId);
  rawDb.query("INSERT INTO cbt_entries (user_id, entry_date, entry_time) VALUES (?, '2026-05-16', '10:00')").run(userId);
  rawDb.query("INSERT INTO dbt_entries (user_id, entry_date, entry_time) VALUES (?, '2026-05-16', '11:00')").run(userId);
  rawDb.query("INSERT INTO memorable_days (user_id, date, title) VALUES (?, '2026-05-16', 'Anniversary')").run(userId);
  rawDb.query("INSERT INTO user_preferences (user_id) VALUES (?)").run(userId);
}

function countUserRows(rawDb: SQLiteDB, userId: number): number {
  let total = 0;
  for (const table of PURGE_TABLES) {
    // table names come from the const list above, never user input.
    const row = rawDb.query(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`).get(userId) as { n: number };
    total += row.n;
  }
  return total;
}

describe("POST /backup/purge", () => {
  test("requires authentication", async () => {
    const { app } = await setup();
    const res = await app.request("/backup/purge", { method: "POST" });
    expect(res.status).toBe(401);
  });

  test("wipes the authenticated user's data across every table", async () => {
    const { ctx, app, cookie, userId } = await setup();
    seedAllUserTables(ctx.rawDb, userId);
    expect(countUserRows(ctx.rawDb, userId)).toBe(PURGE_TABLES.length);

    const purge = await app.request("/backup/purge", {
      method: "POST",
      headers: { cookie },
    });
    expect(purge.status).toBe(200);
    expect(await purge.json()).toEqual({ data: { ok: true } });

    expect(countUserRows(ctx.rawDb, userId)).toBe(0);
  });

  test("does not wipe another user's data (IDOR isolation)", async () => {
    const { ctx, app, userId } = await setup();
    seedAllUserTables(ctx.rawDb, userId);
    const seeded = countUserRows(ctx.rawDb, userId);
    expect(seeded).toBe(PURGE_TABLES.length);

    await seedUser(ctx.db, { email: "purger@example.com", password: "Password123!" });
    const otherLogin = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "purger@example.com", password: "Password123!" }),
    });
    const otherCookie = extractSessionCookie(otherLogin.headers.get("set-cookie"));
    const purge = await app.request("/backup/purge", {
      method: "POST",
      headers: { cookie: otherCookie },
    });
    expect(purge.status).toBe(200);

    expect(countUserRows(ctx.rawDb, userId)).toBe(seeded);
  });
});

describe("backup mood options round-trip", () => {
  test("import restores the mood options list the export carries", async () => {
    const { app, cookie } = await setup();
    const importRes = await app.request("/backup/json/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        diary: { rows: [], moodOptions: { positive_moods: ["joyful", " joyful "], negative_moods: [], general_moods: ["sleepy"] } },
      }),
    });
    expect(importRes.status).toBe(200);

    const exportRes = await app.request("/backup/json", { headers: { cookie } });
    const body = await exportRes.json();
    expect(body.data.diary.moodOptions).toEqual({ positive_moods: ["joyful"], negative_moods: [], general_moods: ["sleepy"] });
  });

  test("a backup without moodOptions leaves the current list alone", async () => {
    const { app, cookie } = await setup();
    await app.request("/mood/options/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ field: "general_moods", value: "sleepy" }),
    });
    const importRes = await app.request("/backup/json/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ diary: { rows: [] } }),
    });
    expect(importRes.status).toBe(200);

    const exportRes = await app.request("/backup/json", { headers: { cookie } });
    const body = await exportRes.json();
    expect(body.data.diary.moodOptions.general_moods).toEqual(["sleepy"]);
  });
});

describe("import rejects rows with a bad date", () => {
  test("names the first bad row and keeps the existing entries", async () => {
    const { app, cookie } = await setup();
    await app.request("/diary", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(diaryBody),
    });
    const res = await app.request("/backup/json/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        diary: { rows: [{ date: "2026-05-16", hour: "08:30:00" }, { date: "16/05/2026", hour: "09:00" }] },
      }),
    });
    expect(res.status).toBe(422);
    expect((await res.json()).error.message).toContain('diary row 2: date "16/05/2026"');

    const list = await app.request("/diary", { headers: { cookie } });
    expect((await list.json()).data).toHaveLength(1);
  });
});

describe("import size limit", () => {
  test("refuses a body over 10 MB before reading it", async () => {
    const { app, cookie } = await setup();
    const oversized = JSON.stringify({ diary: { rows: [{ date: "2026-05-16", hour: "08:30", description: "x".repeat(10 * 1024 * 1024) }] } });
    const res = await app.request("/backup/json/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: oversized,
    });
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe("FILE_TOO_LARGE");
  });
});
