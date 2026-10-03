import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import ExcelJS from "exceljs";
import { z } from "zod";
import { ImportRowError, parseJson } from "../helpers.ts";
import { backupImportSchema, moneyBackupImportSchema } from "../schemas.ts";
import { requireAuth } from "../middleware/auth.ts";
import { buildBackupPayload } from "../money-backup-helpers.ts";
import { addHealthSheets, buildHealthJson, importHealthJson, importHealthSheets, readHealthSheets } from "./backup.ts";
import {
  addMoneySheets,
  importMoneyJson,
  limitUploadSize,
  ROW_LIMIT_ERROR,
  MONEY_SHEETS,
  moneySheetsImport,
  readWorkbook,
} from "./money-backup.ts";
import type { AppEnv as Env } from "../app-env.ts";

/*
 * One backup for both realms. Each import runs in a single transaction, so a
 * file that fails halfway leaves all data as it was. A part the file does not
 * carry is left untouched.
 */
const fullBackup = new Hono<Env>();

fullBackup.use(requireAuth);

// Each realm's own import allows 10 MB; one file now carries both.
const limitJsonSize = bodyLimit({
  maxSize: 20 * 1024 * 1024,
  onError: (c) => c.json({ error: { code: "FILE_TOO_LARGE", message: "Import exceeds 20 MB limit" } }, 413),
});

const fullImportSchema = z
  .object({ health: backupImportSchema.optional(), money: moneyBackupImportSchema.optional() })
  .refine((v) => v.health || v.money, "The backup has neither a health nor a money section");

function importFailed(error: unknown): { error: { code: string; message: string } } {
  if (error instanceof ImportRowError) return { error: { code: "IMPORT_FAILED", message: `Import failed: ${error.message}` } };
  console.error("Full backup import failed:", error);
  return { error: { code: "IMPORT_FAILED", message: "Import failed: invalid or incompatible backup data" } };
}

fullBackup.get("/json", (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  return c.json({ data: { health: buildHealthJson(db, userId), money: buildBackupPayload(db, userId) } });
});

fullBackup.post("/json/import", limitJsonSize, async (c) => {
  const db = c.get("db");
  const rawDb = c.get("rawDb");
  const userId = c.get("userId");
  const body = await parseJson(c, fullImportSchema);
  try {
    rawDb.transaction(() => {
      if (body.health) importHealthJson(db, rawDb, userId, body.health);
      if (body.money) importMoneyJson(db, userId, body.money);
    })();
  } catch (error) {
    return c.json(importFailed(error), 422);
  }
  return c.json({ data: { ok: true } });
});

fullBackup.get("/xlsx", async (c) => {
  const workbook = new ExcelJS.Workbook();
  addHealthSheets(workbook, c.get("db"), c.get("userId"));
  addMoneySheets(workbook, c.get("db"), c.get("userId"));
  c.header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  c.header("content-disposition", `attachment; filename="world-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  return c.body(Buffer.from(await workbook.xlsx.writeBuffer()), 200);
});

fullBackup.post("/xlsx/import", limitUploadSize, async (c) => {
  const workbook = await readWorkbook(c);
  if (workbook instanceof Response) return workbook;

  const hasHealth = Boolean(workbook.getWorksheet("diary") || workbook.getWorksheet("pain"));
  const hasMoney = MONEY_SHEETS.some((name) => workbook.getWorksheet(name));
  if (!hasHealth && !hasMoney) {
    return c.json({ error: { code: "INVALID_FILE", message: "The spreadsheet has no World sheets" } }, 400);
  }
  const healthSheets = hasHealth ? readHealthSheets(workbook) : null;
  const applyMoney = hasMoney ? moneySheetsImport(workbook) : null;
  if ((hasHealth && !healthSheets) || (hasMoney && !applyMoney)) return c.json(ROW_LIMIT_ERROR, 413);

  const db = c.get("db");
  const rawDb = c.get("rawDb");
  const userId = c.get("userId");
  try {
    rawDb.transaction(() => {
      if (healthSheets) importHealthSheets(rawDb, userId, healthSheets);
      if (applyMoney) applyMoney(db, userId);
    })();
  } catch (error) {
    return c.json(importFailed(error), 422);
  }
  return c.json({ data: { ok: true } });
});

export default fullBackup;
