import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import ExcelJS from "exceljs";
import { parseJson } from "../helpers.ts";
import { moneyBackupImportSchema } from "../schemas.ts";
import { requireAuth } from "../middleware/auth.ts";
import { applyImport, buildBackupPayload, coerceBoolean, wipeMoneyData, type ImportCounts } from "../money-backup-helpers.ts";
import { sheetToObjects } from "../xlsx-helpers.ts";
import type { AppEnv as Env } from "../app-env.ts";

const MAX_XLSX_BYTES = 10 * 1024 * 1024;
// base64 inflation is exactly ceil(n * 4/3); +4 accounts for padding
const MAX_XLSX_BASE64_LENGTH = Math.ceil((MAX_XLSX_BYTES * 4) / 3) + 4;
const MAX_IMPORT_ROWS = 50_000;

// Rejects oversized uploads before the body is buffered. The per-branch checks
// inside readWorkbook still run: they catch a body that lies about its length,
// and they report which limit was hit.
const limitUploadSize = bodyLimit({
  maxSize: MAX_XLSX_BYTES,
  onError: (c) => c.json({ error: { code: "FILE_TOO_LARGE", message: "File exceeds 10 MB limit" } }, 413),
});

const moneyBackup = new Hono<Env>();

moneyBackup.use(requireAuth);

/**
 * Runs an import transaction and turns a failure into a 422, matching the
 * health JSON import: a bad backup file is the client's problem, not a server
 * fault, and the two endpoints should be distinguishable the same way.
 */
function runImport(c: Context<Env>, tx: () => ImportCounts): Response {
  let imported: ImportCounts;
  try {
    imported = tx();
  } catch (e) {
    console.error("Money import transaction failed:", e);
    return c.json(
      { error: { code: "IMPORT_FAILED", message: "Import failed: invalid or incompatible backup data" } },
      422,
    );
  }
  return c.json({ data: { ok: true, imported } });
}

moneyBackup.get("/json", (c) => {
  return c.json({ data: buildBackupPayload(c.get("db"), c.get("userId")) });
});

moneyBackup.post("/json/import", limitUploadSize, async (c) => {
  const db = c.get("db");
  const rawDb = c.get("rawDb");
  const userId = c.get("userId");
  const body = await parseJson(c, moneyBackupImportSchema);

  const tx = rawDb.transaction(() => {
    wipeMoneyData(db, userId, true, true);
    return applyImport(db, userId, {
      transactions: body.transactions ?? [],
      monthlyMovements: body.monthlyMovements ?? [],
      monthlySnapshots: body.monthlySnapshots ?? [],
      assetColors: body.assetColors ?? {},
      assetRisks: body.assetRisks ?? {},
      preferences: { showZeroAssets: coerceBoolean((body.preferences ?? {}).showZeroAssets) },
      replaceStyles: true,
      replacePrefs: true,
    });
  });

  return runImport(c, tx);
});

/**
 * Append plain objects as a worksheet: row 1 is the union of the objects'
 * keys, the rest are values in that order. sheetToObjects reads it back.
 */
function addObjectsSheet(wb: ExcelJS.Workbook, name: string, rows: Record<string, unknown>[]): void {
  const ws = wb.addWorksheet(name);
  if (rows.length === 0) return;
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  ws.columns = headers.map((h) => ({ header: h, key: h }));
  for (const row of rows) ws.addRow(row);
}

moneyBackup.get("/xlsx", async (c) => {
  const payload = buildBackupPayload(c.get("db"), c.get("userId"));

  const wb = new ExcelJS.Workbook();
  addObjectsSheet(wb, "rawTransactions", payload.transactions);
  addObjectsSheet(wb, "movements", payload.monthlyMovements);
  addObjectsSheet(wb, "monthlySnapshots", payload.monthlySnapshots);

  const styleAssets = new Set<string>([...Object.keys(payload.assetColors), ...Object.keys(payload.assetRisks)]);
  addObjectsSheet(
    wb,
    "assetStyles",
    Array.from(styleAssets).map((asset) => ({
      asset,
      colorHex: payload.assetColors[asset] ?? "",
      riskLevel: payload.assetRisks[asset] ?? "",
    })),
  );
  addObjectsSheet(wb, "preferences", [{ showZeroAssets: payload.preferences.showZeroAssets }]);

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  c.header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  c.header("content-disposition", `attachment; filename="money-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  return c.body(buf, 200);
});

function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/** Reads the upload from either a multipart form or a JSON {base64} body. */
async function readWorkbook(c: Context<Env>): Promise<ExcelJS.Workbook | Response> {
  const wb = new ExcelJS.Workbook();
  const contentType = c.req.header("content-type") ?? "";
  let bytes: ArrayBuffer;

  if (contentType.includes("multipart/form-data")) {
    const file = (await c.req.formData()).get("file");
    if (!(file instanceof File)) {
      return c.json({ error: { code: "MISSING_FILE", message: "Missing uploaded file in 'file' field" } }, 400);
    }
    if (file.size > MAX_XLSX_BYTES) {
      return c.json({ error: { code: "FILE_TOO_LARGE", message: "File exceeds 10 MB limit" } }, 400);
    }
    bytes = await file.arrayBuffer();
  } else {
    const payload = (await c.req.json().catch(() => null)) as { base64?: string } | null;
    if (typeof payload?.base64 !== "string") {
      return c.json({ error: { code: "MISSING_FILE", message: "Expected multipart form upload or JSON {base64}" } }, 400);
    }
    if (payload.base64.length > MAX_XLSX_BASE64_LENGTH) {
      return c.json({ error: { code: "FILE_TOO_LARGE", message: "File exceeds 10 MB limit" } }, 400);
    }
    const raw = Buffer.from(payload.base64, "base64");
    if (raw.byteLength > MAX_XLSX_BYTES) {
      return c.json({ error: { code: "FILE_TOO_LARGE", message: "File exceeds 10 MB limit" } }, 400);
    }
    bytes = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  }

  // XLSX is a zip; anything else is rejected before ExcelJS sees it.
  if (!looksLikeZip(new Uint8Array(bytes.slice(0, 4)))) {
    return c.json({ error: { code: "INVALID_FILE", message: "Could not parse file as XLSX" } }, 400);
  }
  try {
    await wb.xlsx.load(bytes);
  } catch (e) {
    console.error("[money backup] xlsx parse failed:", e);
    return c.json({ error: { code: "INVALID_FILE", message: "Could not parse file as XLSX" } }, 400);
  }
  return wb;
}

moneyBackup.post("/xlsx/import", limitUploadSize, async (c) => {
  const db = c.get("db");
  const rawDb = c.get("rawDb");
  const userId = c.get("userId");

  const wb = await readWorkbook(c);
  if (wb instanceof Response) return wb;

  const styleSheet = wb.getWorksheet("assetStyles");
  const prefSheet = wb.getWorksheet("preferences");
  const transactions = sheetToObjects(wb.getWorksheet("rawTransactions"));
  const monthlyMovements = sheetToObjects(wb.getWorksheet("movements"));
  const monthlySnapshots = sheetToObjects(wb.getWorksheet("monthlySnapshots"));

  if ([transactions, monthlyMovements, monthlySnapshots].some((rows) => rows.length > MAX_IMPORT_ROWS)) {
    return c.json({ error: { code: "FILE_TOO_LARGE", message: "Import exceeds row limit (50 000 per sheet)" } }, 400);
  }

  const validColorHex = /^#[0-9a-fA-F]{6}$/;
  const validRiskLevels = new Set(["low", "medium", "high"]);
  const assetColors: Record<string, string> = {};
  const assetRisks: Record<string, string> = {};
  for (const row of sheetToObjects(styleSheet)) {
    const asset = String(row.asset ?? "").trim();
    if (!asset) continue;
    const colorHex = String(row.colorHex ?? "").trim();
    const riskLevel = String(row.riskLevel ?? "").trim();
    if (validColorHex.test(colorHex)) assetColors[asset] = colorHex;
    if (validRiskLevels.has(riskLevel)) assetRisks[asset] = riskLevel;
  }

  const prefRow = sheetToObjects(prefSheet)[0] ?? {};
  // A sheet absent from the file means "leave that part alone" rather than
  // "clear it", so styles and preferences survive a partial spreadsheet.
  const replaceStyles = Boolean(styleSheet);
  const replacePrefs = Boolean(prefSheet);

  const tx = rawDb.transaction(() => {
    wipeMoneyData(db, userId, replaceStyles, replacePrefs);
    return applyImport(db, userId, {
      transactions,
      monthlyMovements,
      monthlySnapshots,
      assetColors,
      assetRisks,
      preferences: { showZeroAssets: coerceBoolean(prefRow.showZeroAssets) },
      replaceStyles,
      replacePrefs,
    });
  });

  return runImport(c, tx);
});

moneyBackup.post("/purge", (c) => {
  const db = c.get("db");
  const rawDb = c.get("rawDb");
  const userId = c.get("userId");
  rawDb.transaction(() => wipeMoneyData(db, userId, true, true))();
  return c.json({ data: { ok: true } });
});

export default moneyBackup;
