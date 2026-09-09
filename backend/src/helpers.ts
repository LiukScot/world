import type { Context } from "hono";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { parseCookie, stringifySetCookie } from "cookie";
import { env } from "./env.ts";
import { TAG_TYPES, type TagType, MOOD_TAG_FIELDS, type MoodTagField } from "./schema.ts";

export const PAIN_MULTI_FIELDS = TAG_TYPES;
export type PainMultiField = TagType;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

/** A backup row the import refuses; the message names the row for the user. */
export class ImportRowError extends Error {}

/**
 * Validates one imported entry's date and time. Throws ImportRowError so the
 * surrounding transaction rolls back: a partial restore is worse than none.
 * Seconds are accepted and dropped since the app stores HH:MM.
 */
export function importedDateTime(sheet: string, index: number, date: unknown, time: unknown): { entryDate: string; entryTime: string } {
  const entryDate = String(date ?? "").trim();
  const entryTime = String(time ?? "").trim();
  if (!DATE_RE.test(entryDate)) {
    throw new ImportRowError(`${sheet} row ${index + 1}: date "${entryDate}" is not YYYY-MM-DD`);
  }
  if (!TIME_RE.test(entryTime)) {
    throw new ImportRowError(`${sheet} row ${index + 1}: time "${entryTime}" is not HH:MM`);
  }
  return { entryDate, entryTime: entryTime.slice(0, 5) };
}

export const MOOD_MULTI_FIELDS = MOOD_TAG_FIELDS;
export type MoodMultiField = MoodTagField;

export type MoodTagMap = Record<MoodMultiField, string[]>;
export type PainTagMap = Record<PainMultiField, string[]>;

export async function parseJson<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
  const raw = await c.req.json().catch((err) => { console.error("Failed to parse request JSON:", err); return null; });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HTTPException(400, { message: "Invalid request body" });
  }
  return parsed.data;
}

export function parseIdParam(c: Context, paramName = "id"): { id: number } | Response {
  const id = Number(c.req.param(paramName));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: { code: "INVALID_ID", message: "Invalid id" } }, 400);
  }
  return { id };
}

export function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  const parsed = parseCookie(raw);
  return parsed[name] ?? null;
}

export function buildSessionCookie(sid: string): string {
  return stringifySetCookie({
    name: env.SESSION_COOKIE_NAME,
    value: sid,
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: env.SESSION_TTL_SECONDS,
    secure: env.COOKIE_SECURE
  });
}

export function clearSessionCookie(): string {
  return stringifySetCookie({
    name: env.SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
    secure: env.COOKIE_SECURE
  });
}

export function toUniqueValues(input: unknown): string[] {
  const rawValues = Array.isArray(input)
    ? input.map((value) => String(value).trim())
    : typeof input === "string"
      ? input.split(/(?<!\d),(?!\d)/).map((value) => value.trim())
      : [];

  const values: string[] = [];
  const seen = new Set<string>();
  for (const value of rawValues) {
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    values.push(value);
  }
  return values;
}

export function toCsvValue(input: unknown): string {
  return toUniqueValues(input).join(", ");
}

export function emptyPainTags(): PainTagMap {
  return {
    area: [],
    symptoms: [],
    activities: [],
    medicines: [],
    habits: [],
    other: []
  };
}

export function parseLegacyPainTags(input: unknown): PainTagMap {
  const tags = emptyPainTags();
  if (!input || typeof input !== "object") {
    return tags;
  }
  const record = input as Record<string, unknown>;
  for (const field of PAIN_MULTI_FIELDS) {
    tags[field] = toUniqueValues(record[field]);
  }
  return tags;
}

export function rowPainField(row: Record<string, unknown>, field: PainMultiField): string {
  if (row[field] !== undefined) {
    return toCsvValue(row[field]);
  }

  const legacyTags = parseLegacyPainTags(row.tags);
  if (legacyTags[field].length) {
    return legacyTags[field].join(", ");
  }

  return "";
}

export function mergeOptions(current: string[], incoming: string[]): string[] {
  const out: string[] = [...current];
  const seen = new Set(current.map((value) => value.toLowerCase()));
  for (const value of incoming) {
    const normalized = value.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

interface DiaryBackupRow {
  entry_date: string; entry_time: string;
  mood_level?: number | null; depression_level?: number | null; anxiety_level?: number | null;
  positive_moods?: string | null; negative_moods?: string | null; general_moods?: string | null;
  description?: string | null; gratitude?: string | null; reflection?: string | null;
}

interface PainBackupRow {
  entry_date: string; entry_time: string;
  pain_level?: number | null; fatigue_level?: number | null; coffee_count?: number | null;
  symptoms?: string | null; area?: string | null; activities?: string | null;
  habits?: string | null; other?: string | null; medicines?: string | null; note?: string | null;
}

interface PainApiRow {
  id: number; entryDate: string; entryTime: string;
  painLevel: number | null; fatigueLevel: number | null; coffeeCount: number | null;
  area: string | null; symptoms: string | null; activities: string | null;
  medicines: string | null; habits: string | null; other: string | null;
  note: string | null; createdAt: string; updatedAt: string;
}

interface HealthBackupSheet {
  source: string;
  imported_at: string;
  headers: string[];
  rows: Record<string, string | number | null>[];
}

export function rowsToHealthBackup(diaryRows: DiaryBackupRow[], painRows: PainBackupRow[]): { diary: HealthBackupSheet; pain: HealthBackupSheet } {
  const diary = {
    source: "world-backend",
    imported_at: new Date().toISOString(),
    headers: ["date", "hour", "mood level", "depression", "anxiety", "positive moods", "negative moods", "general moods", "description", "gratitude", "reflection"],
    rows: diaryRows.map((row) => ({
      date: row.entry_date,
      hour: row.entry_time,
      "mood level": row.mood_level ?? "",
      depression: row.depression_level ?? "",
      anxiety: row.anxiety_level ?? "",
      "positive moods": row.positive_moods ?? "",
      "negative moods": row.negative_moods ?? "",
      "general moods": row.general_moods ?? "",
      description: row.description ?? "",
      gratitude: row.gratitude ?? "",
      reflection: row.reflection ?? ""
    }))
  };

  const pain = {
    source: "world-backend",
    imported_at: new Date().toISOString(),
    headers: [
      "date", "hour", "pain level", "fatigue level", "symptoms", "area",
      "activities", "habits", "coffee", "other", "medicines", "note"
    ],
    rows: painRows.map((row) => ({
      date: row.entry_date,
      hour: row.entry_time,
      "pain level": row.pain_level ?? "",
      "fatigue level": row.fatigue_level ?? "",
      symptoms: row.symptoms ?? "",
      area: row.area ?? "",
      activities: row.activities ?? "",
      habits: row.habits ?? "",
      coffee: row.coffee_count ?? "",
      other: row.other ?? "",
      medicines: row.medicines ?? "",
      note: row.note ?? ""
    }))
  };

  return { diary, pain };
}

export function painRowToApi(row: PainApiRow) {
  return {
    id: row.id,
    entryDate: row.entryDate,
    entryTime: row.entryTime,
    painLevel: row.painLevel,
    fatigueLevel: row.fatigueLevel,
    coffeeCount: row.coffeeCount,
    area: row.area ?? "",
    symptoms: row.symptoms ?? "",
    activities: row.activities ?? "",
    medicines: row.medicines ?? "",
    habits: row.habits ?? "",
    other: row.other ?? "",
    note: row.note ?? "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
