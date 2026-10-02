import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./db/drizzle-schema.ts";
import type { DrizzleDB } from "./db/index.ts";
import type { SQLiteDB } from "./db.ts";

const SQLITE_JOURNAL_MODES = new Set(["DELETE", "TRUNCATE", "PERSIST", "MEMORY", "WAL", "OFF"]);

export function openDb(dbPath: string, journalMode = "WAL"): SQLiteDB {
  const db = new Database(dbPath);
  const normalizedJournalMode = journalMode.trim().toUpperCase();
  if (!SQLITE_JOURNAL_MODES.has(normalizedJournalMode)) {
    throw new Error(`Unsupported SQLite journal mode: ${journalMode}`);
  }
  db.exec(`PRAGMA journal_mode = ${normalizedJournalMode};`);
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

export function createDrizzle(sqliteDb: SQLiteDB): DrizzleDB {
  return drizzle(sqliteDb, { schema });
}
