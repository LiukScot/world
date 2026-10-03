import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiEnvelopeSchema, apiFetch, getErrorMessage } from "../lib";
import { apiRequest } from "../transport";
import { saveFile } from "../save-file";
import {
  BACKUP_JSON_EXPORT_OK,
  BACKUP_JSON_IMPORT_OK,
  BACKUP_XLSX_EXPORT_OK,
  BACKUP_XLSX_IMPORT_OK,
  type InlineMessage,
} from "../app/core";

const okSchema = apiEnvelopeSchema(z.object({ ok: z.boolean() }));

// The spreadsheet routes are called with fetch directly (a file, not JSON,
// goes each way), so the error envelope apiFetch would unwrap is read here.
async function responseErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? `${fallback} (HTTP ${response.status})`;
}

function datedName(extension: string): string {
  return `world-backup-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

/**
 * Where a JSON backup is imported. Files made before the single backup hold
 * one realm at the top level. A file with none of the known sections is
 * refused: the Health import would otherwise empty the diary and pain logs.
 */
export function jsonImportPath(backup: unknown): string {
  const keys = backup && typeof backup === "object" ? Object.keys(backup) : [];
  const has = (names: string[]) => names.some((name) => keys.includes(name));
  if (has(["health", "money"])) return "/api/v1/full-backup/json/import";
  if (has(["transactions", "monthlyMovements", "monthlySnapshots"])) return "/api/v1/money/backup/json/import";
  if (has(["diary", "pain", "cbt", "dbt", "memorableDays"])) return "/api/v1/backup/json/import";
  throw new Error("This file is not a World backup");
}

/** Export and import of one backup file holding both Health and Money. */
export function useDataBackup() {
  const queryClient = useQueryClient();

  const run = async (action: () => Promise<void>, done: InlineMessage, changesData: boolean) => {
    try {
      await action();
      if (changesData) await queryClient.invalidateQueries();
      toast.success(done.text);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const exportJson = async () => {
    const payload = await apiFetch("/api/v1/full-backup/json", { method: "GET" }, (raw) => apiEnvelopeSchema(z.unknown()).parse(raw).data);
    await saveFile(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), datedName("json"));
  };

  const importJson = async (file: File) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      throw new Error("File is not valid JSON");
    }
    await apiFetch(jsonImportPath(parsed), { method: "POST", body: JSON.stringify(parsed) }, (raw) => okSchema.parse(raw).data);
  };

  const exportXlsx = async () => {
    const response = await apiRequest("/api/v1/full-backup/xlsx", { credentials: "include" });
    if (!response.ok) throw new Error(await responseErrorMessage(response, "Spreadsheet export failed"));
    await saveFile(await response.blob(), datedName("xlsx"));
  };

  // Older single-realm spreadsheets work too: the route imports whichever
  // realm's sheets the file has.
  const importXlsx = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const response = await apiRequest("/api/v1/full-backup/xlsx/import", { method: "POST", credentials: "include", body: form });
    if (!response.ok) throw new Error(await responseErrorMessage(response, "Spreadsheet import failed"));
  };

  return {
    onExportJson: () => void run(exportJson, BACKUP_JSON_EXPORT_OK, false),
    onImportJson: (file: File) => void run(() => importJson(file), BACKUP_JSON_IMPORT_OK, true),
    onExportXlsx: () => void run(exportXlsx, BACKUP_XLSX_EXPORT_OK, false),
    onImportXlsx: (file: File) => void run(() => importXlsx(file), BACKUP_XLSX_IMPORT_OK, true),
  };
}
