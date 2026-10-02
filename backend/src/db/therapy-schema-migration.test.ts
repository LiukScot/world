import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../db.ts";

/**
 * `CREATE TABLE IF NOT EXISTS` is a no-op against a database that already has
 * the table, so neither a column added to the create statement nor one
 * removed from it ever reaches an existing install. These pin the ALTER
 * TABLEs that do: intensity added, helpful_reasoning dropped.
 *
 * The legacy FTS index is the sharp edge. It covers helpful_reasoning, and
 * its triggers fire on every write to cbt_entries — leave them pointing at a
 * dropped column and the next insert fails, so a test that only checks
 * PRAGMA table_info would pass against a table nobody can write to.
 */
function dbWithLegacyTherapyTables(): Database {
  const db = new Database(":memory:");
  db.query("PRAGMA foreign_keys = ON").run();
  db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL)`);
  db.query("INSERT INTO users (email, password_hash) VALUES ('old@example.com', 'x')").run();
  db.exec(`CREATE TABLE metric_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    label TEXT NOT NULL,
    kind TEXT NOT NULL,
    unit TEXT,
    min_value REAL,
    max_value REAL,
    step REAL,
    config_json TEXT NOT NULL DEFAULT '{}',
    archived_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.query("INSERT INTO metric_types (user_id, key, label, kind) VALUES (1, 'cbt_helpful_reasoning', 'Helpful reasoning', 'text')").run();
  // The two tables exactly as they shipped before, so the FTS triggers the
  // migration creates find every column they index.
  db.exec(`CREATE TABLE cbt_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    entry_date TEXT NOT NULL,
    entry_time TEXT NOT NULL,
    situation TEXT NOT NULL DEFAULT '',
    thoughts TEXT NOT NULL DEFAULT '',
    helpful_reasoning TEXT NOT NULL DEFAULT '',
    main_unhelpful_thought TEXT NOT NULL DEFAULT '',
    effect_of_believing TEXT NOT NULL DEFAULT '',
    evidence_for_against TEXT NOT NULL DEFAULT '',
    alternative_explanation TEXT NOT NULL DEFAULT '',
    worst_best_scenario TEXT NOT NULL DEFAULT '',
    friend_advice TEXT NOT NULL DEFAULT '',
    productive_response TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  db.exec(`CREATE TABLE dbt_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    entry_date TEXT NOT NULL,
    entry_time TEXT NOT NULL,
    emotion_name TEXT NOT NULL DEFAULT '',
    allow_affirmation TEXT NOT NULL DEFAULT '',
    watch_emotion TEXT NOT NULL DEFAULT '',
    body_location TEXT NOT NULL DEFAULT '',
    body_feeling TEXT NOT NULL DEFAULT '',
    present_moment TEXT NOT NULL DEFAULT '',
    emotion_returns TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  /*
   * The index and its triggers as they were, covering helpful_reasoning.
   * Without them the migration's DROP path is never taken — the create
   * statements would just build a fresh index with the new column list, and
   * removing the DROP would not fail a single assertion.
   */
  db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS cbt_fts USING fts5(
    situation,
    thoughts,
    helpful_reasoning,
    main_unhelpful_thought,
    effect_of_believing,
    evidence_for_against,
    alternative_explanation,
    worst_best_scenario,
    friend_advice,
    productive_response,
    content='cbt_entries',
    content_rowid='id',
    tokenize='unicode61 remove_diacritics 2'
  )`);
  db.exec(`CREATE TRIGGER IF NOT EXISTS cbt_fts_ai AFTER INSERT ON cbt_entries BEGIN
    INSERT INTO cbt_fts(rowid, situation, thoughts, helpful_reasoning, main_unhelpful_thought, effect_of_believing, evidence_for_against, alternative_explanation, worst_best_scenario, friend_advice, productive_response)
    VALUES (new.id, new.situation, new.thoughts, new.helpful_reasoning, new.main_unhelpful_thought, new.effect_of_believing, new.evidence_for_against, new.alternative_explanation, new.worst_best_scenario, new.friend_advice, new.productive_response);
  END`);
  db.exec(`CREATE TRIGGER IF NOT EXISTS cbt_fts_ad AFTER DELETE ON cbt_entries BEGIN
    INSERT INTO cbt_fts(cbt_fts, rowid, situation, thoughts, helpful_reasoning, main_unhelpful_thought, effect_of_believing, evidence_for_against, alternative_explanation, worst_best_scenario, friend_advice, productive_response)
    VALUES ('delete', old.id, old.situation, old.thoughts, old.helpful_reasoning, old.main_unhelpful_thought, old.effect_of_believing, old.evidence_for_against, old.alternative_explanation, old.worst_best_scenario, old.friend_advice, old.productive_response);
  END`);
  db.exec(`CREATE TRIGGER IF NOT EXISTS cbt_fts_au AFTER UPDATE ON cbt_entries BEGIN
    INSERT INTO cbt_fts(cbt_fts, rowid, situation, thoughts, helpful_reasoning, main_unhelpful_thought, effect_of_believing, evidence_for_against, alternative_explanation, worst_best_scenario, friend_advice, productive_response)
    VALUES ('delete', old.id, old.situation, old.thoughts, old.helpful_reasoning, old.main_unhelpful_thought, old.effect_of_believing, old.evidence_for_against, old.alternative_explanation, old.worst_best_scenario, old.friend_advice, old.productive_response);
    INSERT INTO cbt_fts(rowid, situation, thoughts, helpful_reasoning, main_unhelpful_thought, effect_of_believing, evidence_for_against, alternative_explanation, worst_best_scenario, friend_advice, productive_response)
    VALUES (new.id, new.situation, new.thoughts, new.helpful_reasoning, new.main_unhelpful_thought, new.effect_of_believing, new.evidence_for_against, new.alternative_explanation, new.worst_best_scenario, new.friend_advice, new.productive_response);
  END`);

  db.query("INSERT INTO cbt_entries (user_id, entry_date, entry_time, situation) VALUES (1, '2026-01-02', '09:00', 'written before the scale existed')").run();
  db.query("INSERT INTO dbt_entries (user_id, entry_date, entry_time, emotion_name) VALUES (1, '2026-01-02', '09:00', 'written before the scale existed')").run();
  return db;
}

const columns = (db: Database, table: string) =>
  (db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((r) => r.name);

describe("therapy schema migration", () => {
  test.each(["cbt_entries", "dbt_entries"])("adds intensity to an existing %s", (table) => {
    const db = dbWithLegacyTherapyTables();
    expect(columns(db, table)).not.toContain("intensity");

    runMigrations(db);

    expect(columns(db, table)).toContain("intensity");
    const row = db.query(`SELECT intensity FROM ${table}`).get() as { intensity: number | null };
    expect(row.intensity).toBeNull();
  });

  test("re-running migrations does not fail on the already-added column", () => {
    const db = dbWithLegacyTherapyTables();
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();
  });
});

describe("dropping cbt helpful_reasoning", () => {
  test("removes the column from an existing table", () => {
    const db = dbWithLegacyTherapyTables();
    expect(columns(db, "cbt_entries")).toContain("helpful_reasoning");

    runMigrations(db);

    expect(columns(db, "cbt_entries")).not.toContain("helpful_reasoning");
  });

  test("leaves the rest of the row alone", () => {
    const db = dbWithLegacyTherapyTables();
    runMigrations(db);
    const row = db.query(`SELECT situation FROM cbt_entries`).get() as { situation: string };
    expect(row.situation).toBe("written before the scale existed");
  });

  test("leaves the table writable", () => {
    const db = dbWithLegacyTherapyTables();
    runMigrations(db);

    expect(() =>
      db
        .query(`INSERT INTO cbt_entries (user_id, entry_date, entry_time, situation) VALUES (1, '2026-03-01', '08:00', 'after the drop')`)
        .run(),
    ).not.toThrow();
  });

  test("removes the full-text indexes and their triggers", () => {
    const db = dbWithLegacyTherapyTables();
    runMigrations(db);

    const left = db
      .query(`SELECT name FROM sqlite_master WHERE name LIKE '%\\_fts%' ESCAPE '\\'`)
      .all();
    expect(left).toEqual([]);
  });

  test("clears the metric_types row that pointed at it", () => {
    const db = dbWithLegacyTherapyTables();
    runMigrations(db);
    const left = db.query(`SELECT COUNT(*) AS c FROM metric_types WHERE key = 'cbt_helpful_reasoning'`).get() as { c: number };
    expect(left.c).toBe(0);
  });
});
