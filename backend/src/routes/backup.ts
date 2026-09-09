import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import ExcelJS from "exceljs";
import type { DrizzleDB } from "../db/index.ts";
import { diaryEntries, painEntries, userPreferences, painRemovedOptions } from "../db/index.ts";
import { toNullableInt, toNullableNumber } from "../db.ts";
import {
  parseJson,
  MOOD_MULTI_FIELDS,
  PAIN_MULTI_FIELDS,
  type PainMultiField,
  rowsToHealthBackup,
  rowPainField,
  mergeOptions,
} from "../helpers.ts";
import { backupImportSchema, DEFAULT_MODEL } from "../schemas.ts";
import { requireAuth } from "../middleware/auth.ts";
import { sheetToObjects } from "../xlsx-helpers.ts";
import { loadPainOptionsForUser, loadPreselectedMedicines } from "./pain.ts";
import { loadMoodOptionsForUser } from "./mood.ts";
import type { AppEnv as Env } from "../app-env.ts";

const backup = new Hono<Env>();

backup.use(requireAuth);

function loadHealthBackup(db: DrizzleDB, userId: number) {
  const diaryRows = db.select().from(diaryEntries).where(eq(diaryEntries.userId, userId))
    .orderBy(desc(diaryEntries.entryDate), desc(diaryEntries.entryTime)).all();
  const painRows = db.select().from(painEntries).where(eq(painEntries.userId, userId))
    .orderBy(desc(painEntries.entryDate), desc(painEntries.entryTime)).all();

  // Map Drizzle rows to the format rowsToHealthBackup expects (snake_case)
  const diaryForBackup = diaryRows.map((r) => ({
    entry_date: r.entryDate, entry_time: r.entryTime,
    mood_level: r.moodLevel, depression_level: r.depressionLevel, anxiety_level: r.anxietyLevel,
    positive_moods: r.positiveMoods, negative_moods: r.negativeMoods, general_moods: r.generalMoods,
    description: r.description, gratitude: r.gratitude, reflection: r.reflection,
  }));
  const painForBackup = painRows.map((r) => ({
    entry_date: r.entryDate, entry_time: r.entryTime,
    pain_level: r.painLevel, fatigue_level: r.fatigueLevel, coffee_count: r.coffeeCount,
    symptoms: r.symptoms, area: r.area, activities: r.activities,
    habits: r.habits, other: r.other, medicines: r.medicines, note: r.note,
  }));
  return rowsToHealthBackup(diaryForBackup, painForBackup);
}

backup.get("/json", (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const prefs = db.select({
    model: userPreferences.model,
    chatRange: userPreferences.chatRange,
    lastRange: userPreferences.lastRange,
    graphSelectionJson: userPreferences.graphSelectionJson,
  }).from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1).get();

  const result = loadHealthBackup(db, userId);

  const removedRows = db.select({ field: painRemovedOptions.field, value: painRemovedOptions.value })
    .from(painRemovedOptions).where(eq(painRemovedOptions.userId, userId)).all();
  const removedMap: Record<PainMultiField, string[]> = {
    area: [], symptoms: [], activities: [], medicines: [], habits: [], other: []
  };
  for (const row of removedRows) {
    if (!PAIN_MULTI_FIELDS.includes(row.field as PainMultiField)) continue;
    removedMap[row.field as PainMultiField] = mergeOptions(removedMap[row.field as PainMultiField], [row.value]);
  }

  return c.json({
    data: {
      diary: { ...result.diary, moodOptions: loadMoodOptionsForUser(db, userId) },
      pain: {
        ...result.pain,
        options: {
          options: loadPainOptionsForUser(db, userId),
          removed: removedMap,
          preselectedMedicines: loadPreselectedMedicines(db, userId),
        },
      },
      prefs: {
        model: prefs?.model ?? DEFAULT_MODEL,
        chatRange: prefs?.chatRange ?? "all",
        lastRange: prefs?.lastRange ?? "all",
        graphSelection: (() => {
          try { return prefs?.graphSelectionJson ? JSON.parse(prefs.graphSelectionJson) : {}; }
          catch (err) { console.error("Failed to parse graphSelectionJson:", err); return {}; }
        })(),
      }
    }
  });
});

// JSON import and XLSX routes use rawDb for transactions (bulk ops with prepared statements)
backup.post("/json/import", async (c) => {
  const rawDb = c.get("rawDb");
  const userId = c.get("userId");
  const body = await parseJson(c, backupImportSchema);

  const parsedPrefs = body.prefs ?? null;

  const tx = rawDb.transaction(() => {
    rawDb.query(`DELETE FROM pain_entries WHERE user_id = ?`).run(userId);
    rawDb.query(`DELETE FROM diary_entries WHERE user_id = ?`).run(userId);

    if (body.diary?.rows) {
      const insertDiary = rawDb.query(
        `INSERT INTO diary_entries (user_id, entry_date, entry_time, mood_level, depression_level, anxiety_level, positive_moods, negative_moods, general_moods, description, gratitude, reflection)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const row of body.diary.rows) {
        insertDiary.run(
          userId,
          String(row.date ?? row.entryDate ?? ""),
          String(row.hour ?? row.entryTime ?? "00:00"),
          toNullableNumber(row["mood level"] ?? row.moodLevel),
          toNullableNumber(row.depression ?? row.depressionLevel),
          toNullableNumber(row.anxiety ?? row.anxietyLevel),
          String(row["positive moods"] ?? row.positiveMoods ?? ""),
          String(row["negative moods"] ?? row.negativeMoods ?? ""),
          String(row["general moods"] ?? row.generalMoods ?? ""),
          String(row.description ?? ""),
          String(row.gratitude ?? ""),
          String(row.reflection ?? "")
        );
      }
    }

    if (body.pain?.rows) {
      const insertPain = rawDb.query(
        `INSERT INTO pain_entries (user_id, entry_date, entry_time, pain_level, fatigue_level, coffee_count, area, symptoms, activities, medicines, habits, other, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const row of body.pain.rows) {
        insertPain.run(
          userId,
          String(row.date ?? row.entryDate ?? ""),
          String(row.hour ?? row.entryTime ?? "00:00"),
          toNullableInt(row["pain level"] ?? row.painLevel),
          toNullableInt(row["fatigue level"] ?? row.fatigueLevel),
          toNullableInt(row.coffee ?? row.coffeeCount),
          rowPainField(row, "area"),
          rowPainField(row, "symptoms"),
          rowPainField(row, "activities"),
          rowPainField(row, "medicines"),
          rowPainField(row, "habits"),
          rowPainField(row, "other"),
          String(row.note ?? "")
        );
      }
    }

    rawDb.query(`DELETE FROM pain_removed_options WHERE user_id = ?`).run(userId);
    const removed = body.pain?.options?.removed;
    if (removed && typeof removed === "object") {
      const insertRemoved = rawDb.query(
        `INSERT INTO pain_removed_options (user_id, field, value)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id, field, value) DO NOTHING`
      );
      for (const field of PAIN_MULTI_FIELDS) {
        const values = (removed as Record<string, unknown>)[field];
        if (!Array.isArray(values)) continue;
        for (const raw of values) {
          const normalized = String(raw).trim();
          if (!normalized) continue;
          insertRemoved.run(userId, field, normalized);
        }
      }
    }

    // Restore the pain options list and medicine preselection. Guarded on the
    // options block being present so legacy backups (which omit it) leave the
    // user's existing options untouched. When preselectedMedicines is absent
    // (pre-feature backups), medicines default to preselected (column default).
    const importedOptions = body.pain?.options?.options;
    if (importedOptions && typeof importedOptions === "object") {
      rawDb.query(`DELETE FROM pain_options WHERE user_id = ?`).run(userId);
      const rawPreselected = body.pain?.options?.preselectedMedicines;
      const preselectedSet = Array.isArray(rawPreselected)
        ? new Set(rawPreselected.map((v) => String(v).trim()))
        : null;
      const insertOption = rawDb.query(
        `INSERT INTO pain_options (user_id, field, value, preselected)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, field, value) DO NOTHING`
      );
      for (const field of PAIN_MULTI_FIELDS) {
        const values = (importedOptions as Record<string, unknown>)[field];
        if (!Array.isArray(values)) continue;
        for (const raw of values) {
          const normalized = String(raw).trim();
          if (!normalized) continue;
          const preselected = field === "medicines" && preselectedSet ? (preselectedSet.has(normalized) ? 1 : 0) : 1;
          insertOption.run(userId, field, normalized, preselected);
        }
      }
    }

    // The export carries diary.moodOptions; the same presence guard as the
    // pain options above keeps legacy backups from emptying the list.
    const importedMoodOptions = body.diary?.moodOptions;
    if (importedMoodOptions) {
      rawDb.query(`DELETE FROM mood_options WHERE user_id = ?`).run(userId);
      const insertMoodOption = rawDb.query(
        `INSERT INTO mood_options (user_id, field, value)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id, field, value) DO NOTHING`
      );
      for (const field of MOOD_MULTI_FIELDS) {
        for (const raw of importedMoodOptions[field] ?? []) {
          const normalized = raw.trim();
          if (!normalized) continue;
          insertMoodOption.run(userId, field, normalized);
        }
      }
    }

    if (parsedPrefs) {
      const pref = parsedPrefs;
      rawDb.query(
        `INSERT INTO user_preferences (user_id, model, chat_range, last_range, graph_selection_json, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET
          model=excluded.model,
          chat_range=excluded.chat_range,
          last_range=excluded.last_range,
          graph_selection_json=excluded.graph_selection_json,
          updated_at=CURRENT_TIMESTAMP`
      ).run(userId, pref.model, pref.chatRange, pref.lastRange, JSON.stringify(pref.graphSelection ?? {}));
    }
  });

  try {
    tx();
  } catch (e) {
    console.error("JSON import transaction failed:", e);
    return c.json({ error: { code: "IMPORT_FAILED", message: "Import failed: invalid or incompatible backup data" } }, 422);
  }
  return c.json({ data: { ok: true } });
});

backup.get("/xlsx", async (c) => {
  const result = loadHealthBackup(c.get("db"), c.get("userId"));
  const workbook = new ExcelJS.Workbook();

  const diarySheet = workbook.addWorksheet("diary");
  diarySheet.columns = result.diary.headers.map((h: string) => ({ header: h, key: h }));
  for (const row of result.diary.rows) diarySheet.addRow(row);

  const painSheet = workbook.addWorksheet("pain");
  painSheet.columns = result.pain.headers.map((h: string) => ({ header: h, key: h }));
  for (const row of result.pain.rows) painSheet.addRow(row);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="health-${new Date().toISOString().slice(0, 10)}.xlsx"`
    }
  });
});

const XLSX_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
// base64 4 chars encode 3 raw bytes; pre-check string length before decode
const XLSX_UPLOAD_MAX_BASE64_CHARS = Math.ceil(XLSX_UPLOAD_MAX_BYTES / 3) * 4 + 4;
const XLSX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

backup.post("/xlsx/import", async (c) => {
  const rawDb = c.get("rawDb");
  const userId = c.get("userId");

  const workbook = new ExcelJS.Workbook();
  const contentType = c.req.header("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return c.json({ error: { code: "MISSING_FILE", message: "Missing uploaded file in 'file' field" } }, 400);
    }
    const filename = file.name.toLowerCase();
    if (!filename.endsWith(".xlsx") && !filename.endsWith(".xls")) {
      return c.json(
        { error: { code: "INVALID_FILE_TYPE", message: "Expected .xlsx or .xls upload" } },
        400
      );
    }
    if (!XLSX_MIME_TYPES.has(file.type)) {
      return c.json(
        { error: { code: "INVALID_FILE_TYPE", message: "Unsupported MIME type" } },
        400
      );
    }
    if (file.size > XLSX_UPLOAD_MAX_BYTES) {
      return c.json(
        { error: { code: "FILE_TOO_LARGE", message: "XLSX upload exceeds 10 MB limit" } },
        413
      );
    }
    const arrayBuffer = await file.arrayBuffer();
    // Verify ZIP magic bytes (PK\x03\x04) — client-reported MIME is not trustworthy
    const magic = new Uint8Array(arrayBuffer, 0, 4);
    if (magic[0] !== 0x50 || magic[1] !== 0x4b || magic[2] !== 0x03 || magic[3] !== 0x04) {
      return c.json({ error: { code: "INVALID_FILE_TYPE", message: "File does not appear to be a valid XLSX file" } }, 400);
    }
    await workbook.xlsx.load(arrayBuffer);
  } else {
    const payload = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!payload?.base64 || typeof payload.base64 !== "string") {
      return c.json({ error: { code: "MISSING_FILE", message: "Expected multipart form upload or JSON {base64}" } }, 400);
    }
    if (payload.base64.length > XLSX_UPLOAD_MAX_BASE64_CHARS) {
      return c.json(
        { error: { code: "FILE_TOO_LARGE", message: "XLSX upload exceeds 10 MB limit" } },
        413
      );
    }
    const decoded = Buffer.from(payload.base64, "base64");
    if (decoded.byteLength > XLSX_UPLOAD_MAX_BYTES) {
      return c.json(
        { error: { code: "FILE_TOO_LARGE", message: "XLSX upload exceeds 10 MB limit" } },
        413
      );
    }
    // Verify ZIP magic bytes (PK\x03\x04) — base64 payload can contain arbitrary bytes
    if (decoded[0] !== 0x50 || decoded[1] !== 0x4b || decoded[2] !== 0x03 || decoded[3] !== 0x04) {
      return c.json({ error: { code: "INVALID_FILE_TYPE", message: "File does not appear to be a valid XLSX file" } }, 400);
    }
    await workbook.xlsx.load(decoded.buffer.slice(decoded.byteOffset, decoded.byteOffset + decoded.byteLength));
  }

  const diaryRows = sheetToObjects(workbook.getWorksheet("diary"));
  const painRows = sheetToObjects(workbook.getWorksheet("pain"));

  const tx = rawDb.transaction(() => {
    rawDb.query(`DELETE FROM pain_entries WHERE user_id = ?`).run(userId);
    rawDb.query(`DELETE FROM diary_entries WHERE user_id = ?`).run(userId);

    const insertDiary = rawDb.query(
      `INSERT INTO diary_entries (user_id, entry_date, entry_time, mood_level, depression_level, anxiety_level, description, gratitude, reflection, positive_moods, negative_moods, general_moods)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const row of diaryRows) {
      insertDiary.run(
        userId,
        String(row.date ?? ""),
        String(row.hour ?? "00:00"),
        toNullableNumber(row["mood level"]),
        toNullableNumber(row.depression),
        toNullableNumber(row.anxiety),
        String(row.description ?? ""),
        String(row.gratitude ?? ""),
        String(row.reflection ?? ""),
        String(row["positive moods"] ?? row.positive_moods ?? ""),
        String(row["negative moods"] ?? row.negative_moods ?? ""),
        String(row["general moods"] ?? row.general_moods ?? "")
      );
    }

    const insertPain = rawDb.query(
      `INSERT INTO pain_entries (user_id, entry_date, entry_time, pain_level, fatigue_level, coffee_count, area, symptoms, activities, medicines, habits, other, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const row of painRows) {
      insertPain.run(
        userId,
        String(row.date ?? ""),
        String(row.hour ?? "00:00"),
        toNullableInt(row["pain level"]),
        toNullableInt(row["fatigue level"]),
        toNullableInt(row.coffee),
        rowPainField(row, "area"),
        rowPainField(row, "symptoms"),
        rowPainField(row, "activities"),
        rowPainField(row, "medicines"),
        rowPainField(row, "habits"),
        rowPainField(row, "other"),
        String(row.note ?? "")
      );
    }
  });

  try {
    tx();
  } catch (e) {
    console.error("XLSX import transaction failed:", e);
    return c.json({ error: { code: "IMPORT_FAILED", message: "Import failed: invalid or incompatible XLSX data" } }, 422);
  }
  return c.json({ data: { ok: true, imported: { diaryRows: diaryRows.length, painRows: painRows.length } } });
});

backup.post("/purge", async (c) => {
  const rawDb = c.get("rawDb");
  const userId = c.get("userId");
  const tx = rawDb.transaction(() => {
    rawDb.query(`DELETE FROM pain_entries WHERE user_id = ?`).run(userId);
    rawDb.query(`DELETE FROM diary_entries WHERE user_id = ?`).run(userId);
    rawDb.query(`DELETE FROM cbt_entries WHERE user_id = ?`).run(userId);
    rawDb.query(`DELETE FROM dbt_entries WHERE user_id = ?`).run(userId);
    rawDb.query(`DELETE FROM memorable_days WHERE user_id = ?`).run(userId);
    rawDb.query(`DELETE FROM user_preferences WHERE user_id = ?`).run(userId);
    rawDb.query(`DELETE FROM pain_options WHERE user_id = ?`).run(userId);
    rawDb.query(`DELETE FROM pain_removed_options WHERE user_id = ?`).run(userId);
    rawDb.query(`DELETE FROM mood_options WHERE user_id = ?`).run(userId);
  });
  tx();
  return c.json({ data: { ok: true } });
});

export default backup;
