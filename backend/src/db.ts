import type { Database } from "bun:sqlite";
import { migrationStatements, MOOD_TAG_FIELDS, SCHEMA_VERSION, TAG_TYPES } from "./schema.ts";

export type SQLiteDB = Database;

const legacyIndexes = ["idx_pain_tags_entry", "idx_pain_catalog_user"];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function tableExists(db: SQLiteDB, tableName: string): boolean {
  const row = db
    .query(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`)
    .get(tableName) as { name?: string } | null;
  return Boolean(row?.name);
}

const ALLOWED_TABLE_NAMES = new Set([
  "diary_entries",
  "pain_entries",
  "user_preferences",
  "pain_options",
  "monthly_movements",
  "memorable_days",
  "cbt_entries",
  "dbt_entries",
]);

function columnExists(db: SQLiteDB, tableName: string, columnName: string): boolean {
  if (!ALLOWED_TABLE_NAMES.has(tableName)) {
    throw new Error(`columnExists: disallowed table name "${tableName}"`);
  }
  const rows = db.query(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === columnName);
}

// Columns left behind by removed features. Guarded by columnExists so the drop
// runs once against an existing database and is a no-op from then on; SQLite
// rebuilds the table, which is why this is not in the plain statement list.
function dropRemovedColumns(db: SQLiteDB): void {
  if (columnExists(db, "user_preferences", "birthday")) {
    db.exec(`ALTER TABLE user_preferences DROP COLUMN birthday`);
  }
  if (columnExists(db, "memorable_days", "repeat_mode")) {
    db.exec(`ALTER TABLE memorable_days DROP COLUMN repeat_mode`);
  }
}

function ensureMoodColumns(db: SQLiteDB): void {
  for (const column of MOOD_TAG_FIELDS) {
    if (columnExists(db, "diary_entries", column)) {
      continue;
    }
    db.exec(`ALTER TABLE diary_entries ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
  }
}

function ensurePainColumns(db: SQLiteDB): void {
  for (const column of TAG_TYPES) {
    if (columnExists(db, "pain_entries", column)) {
      continue;
    }
    db.exec(`ALTER TABLE pain_entries ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
  }
}

function ensureUserPreferenceColumns(db: SQLiteDB): void {
  if (!columnExists(db, "user_preferences", "show_zero_assets")) {
    db.exec(`ALTER TABLE user_preferences ADD COLUMN show_zero_assets INTEGER NOT NULL DEFAULT 0`);
  }
}

function ensurePainOptionColumns(db: SQLiteDB): void {
  if (!columnExists(db, "pain_options", "preselected")) {
    db.exec(`ALTER TABLE pain_options ADD COLUMN preselected INTEGER NOT NULL DEFAULT 1`);
  }
}

function ensureMovementColumns(db: SQLiteDB): void {
  if (!columnExists(db, "monthly_movements", "cadence")) {
    db.exec(`ALTER TABLE monthly_movements ADD COLUMN cadence TEXT NOT NULL DEFAULT 'monthly'`);
  }
}

// Nullable on purpose: an entry written before the scale existed has no
// intensity, and 0 or 1 would both claim it does.
function ensureTherapyIntensityColumns(db: SQLiteDB): void {
  for (const table of ["cbt_entries", "dbt_entries"] as const) {
    if (!columnExists(db, table, "intensity")) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN intensity INTEGER`);
    }
  }
}

/*
 * The full-text indexes were built for a search feature that was removed, and
 * nothing queries them. Runs first: their triggers name the columns of the
 * entry tables, so a column cannot be dropped while they exist.
 */
function dropFtsIndexes(db: SQLiteDB): void {
  for (const table of ["diary", "cbt", "dbt", "pain"]) {
    for (const suffix of ["ai", "ad", "au"]) {
      db.exec(`DROP TRIGGER IF EXISTS ${table}_fts_${suffix}`);
    }
    db.exec(`DROP TABLE IF EXISTS ${table}_fts`);
  }
}

// The "helpful reasoning" prompt was removed from the CBT worksheet.
function dropCbtHelpfulReasoning(db: SQLiteDB): void {
  if (!columnExists(db, "cbt_entries", "helpful_reasoning")) {
    return;
  }
  db.exec(`ALTER TABLE cbt_entries DROP COLUMN helpful_reasoning`);
  // metric_types enumerates the fields a custom page can pull in, so a row
  // pointing at a dropped column would offer a field that cannot be read.
  // The table postdates cbt_entries, so an old enough database lacks it.
  if (tableExists(db, "metric_types")) {
    db.exec(`DELETE FROM metric_types WHERE key = 'cbt_helpful_reasoning'`);
  }
}

function backfillPainColumnsFromLegacyTags(db: SQLiteDB): void {
  if (!tableExists(db, "pain_entry_tags")) {
    return;
  }

  for (const column of TAG_TYPES) {
    db
      .query(
        `UPDATE pain_entries
         SET ${column} = COALESCE(
           (
             SELECT GROUP_CONCAT(tag_value, ', ')
             FROM (
               SELECT tag_value
               FROM pain_entry_tags
               WHERE pain_entry_id = pain_entries.id AND tag_type = ?
               ORDER BY position ASC, id ASC
             ) ordered_tags
           ),
           ''
         )
         WHERE ${column} IS NULL OR TRIM(${column}) = ''`
      )
      .run(column);
  }
}

function dropLegacyPainTables(db: SQLiteDB): void {
  for (const indexName of legacyIndexes) {
    db.exec(`DROP INDEX IF EXISTS ${indexName}`);
  }
  db.exec("DROP TABLE IF EXISTS pain_entry_tags");
  db.exec("DROP TABLE IF EXISTS pain_tag_catalog");
}

export function runMigrations(db: SQLiteDB): void {
  const tx = db.transaction(() => {
    dropFtsIndexes(db);
    dropCbtHelpfulReasoning(db);

    for (const stmt of migrationStatements) {
      db.exec(stmt);
    }

    ensurePainColumns(db);
    ensureMoodColumns(db);
    ensureUserPreferenceColumns(db);
    ensurePainOptionColumns(db);
    ensureMovementColumns(db);
    ensureTherapyIntensityColumns(db);
    backfillPainColumnsFromLegacyTags(db);
    dropLegacyPainTables(db);
    dropRemovedColumns(db);

    db.query(
      `INSERT INTO app_meta(key, value) VALUES('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`
    ).run(String(SCHEMA_VERSION));
  });

  try {
    tx();
  } catch (error) {
    const message = getErrorMessage(error);
    throw new Error(`Migration failed: ${message}`);
  }
}

export function toNullableInt(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export function toNullableNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  return n;
}
