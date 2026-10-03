import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, index, uniqueIndex, primaryKey } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  disabledAt: text("disabled_at"),
});

export const diaryEntries = sqliteTable(
  "diary_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    entryDate: text("entry_date").notNull(),
    entryTime: text("entry_time").notNull(),
    moodLevel: integer("mood_level"),
    depressionLevel: integer("depression_level"),
    anxietyLevel: integer("anxiety_level"),
    positiveMoods: text("positive_moods").default(""),
    negativeMoods: text("negative_moods").default(""),
    generalMoods: text("general_moods").default(""),
    description: text("description"),
    gratitude: text("gratitude"),
    reflection: text("reflection"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_diary_user_date").on(table.userId, table.entryDate, table.entryTime),
  ]
);

export const painEntries = sqliteTable(
  "pain_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    entryDate: text("entry_date").notNull(),
    entryTime: text("entry_time").notNull(),
    painLevel: integer("pain_level"),
    fatigueLevel: integer("fatigue_level"),
    coffeeCount: integer("coffee_count"),
    area: text("area").notNull().default(""),
    symptoms: text("symptoms").notNull().default(""),
    activities: text("activities").notNull().default(""),
    medicines: text("medicines").notNull().default(""),
    habits: text("habits").notNull().default(""),
    other: text("other").notNull().default(""),
    note: text("note"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_pain_user_date").on(table.userId, table.entryDate, table.entryTime),
  ]
);

export const cbtEntries = sqliteTable(
  "cbt_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    entryDate: text("entry_date").notNull(),
    entryTime: text("entry_time").notNull(),
    intensity: integer("intensity"),
    situation: text("situation").notNull().default(""),
    thoughts: text("thoughts").notNull().default(""),
    mainUnhelpfulThought: text("main_unhelpful_thought").notNull().default(""),
    effectOfBelieving: text("effect_of_believing").notNull().default(""),
    evidenceForAgainst: text("evidence_for_against").notNull().default(""),
    alternativeExplanation: text("alternative_explanation").notNull().default(""),
    worstBestScenario: text("worst_best_scenario").notNull().default(""),
    friendAdvice: text("friend_advice").notNull().default(""),
    productiveResponse: text("productive_response").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_cbt_user_date").on(table.userId, table.entryDate, table.entryTime),
  ]
);

export const dbtEntries = sqliteTable(
  "dbt_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    entryDate: text("entry_date").notNull(),
    entryTime: text("entry_time").notNull(),
    intensity: integer("intensity"),
    emotionName: text("emotion_name").notNull().default(""),
    allowAffirmation: text("allow_affirmation").notNull().default(""),
    watchEmotion: text("watch_emotion").notNull().default(""),
    bodyLocation: text("body_location").notNull().default(""),
    bodyFeeling: text("body_feeling").notNull().default(""),
    presentMoment: text("present_moment").notNull().default(""),
    emotionReturns: text("emotion_returns").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_dbt_user_date").on(table.userId, table.entryDate, table.entryTime),
  ]
);

export const userPreferences = sqliteTable("user_preferences", {
  userId: integer("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  model: text("model").notNull().default("mistral-small-latest"),
  chatRange: text("chat_range").notNull().default("all"),
  lastRange: text("last_range").notNull().default("all"),
  graphSelectionJson: text("graph_selection_json").notNull().default("{}"),
  // Money realm: kept here rather than in a second preferences table, since
  // there is one row per user either way.
  showZeroAssets: integer("show_zero_assets").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const memorableDays = sqliteTable(
  "memorable_days",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    title: text("title").notNull(),
    emoji: text("emoji").notNull().default(""),
    description: text("description").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_memorable_days_user_date").on(table.userId, table.date, table.id),
  ]
);

export const webdavBackup = sqliteTable("webdav_backup", {
  userId: integer("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull().default(""),
  folder: text("folder").notNull().default(""),
  username: text("username").notNull().default(""),
  enabled: integer("enabled").notNull().default(0),
  lastAttemptAt: text("last_attempt_at"),
  lastSuccessAt: text("last_success_at"),
  lastError: text("last_error"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const sessions = sqliteTable("sessions", {
  sid: text("sid").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const painRemovedOptions = sqliteTable(
  "pain_removed_options",
  {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    value: text("value").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.field, table.value] }),
  ]
);

export const painOptions = sqliteTable("pain_options", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  field: text("field").notNull(),
  value: text("value").notNull(),
  preselected: integer("preselected").notNull().default(1),
});

export const moodOptions = sqliteTable("mood_options", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  field: text("field").notNull(),
  value: text("value").notNull(),
});

export const metricTypes = sqliteTable(
  "metric_types",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    kind: text("kind").notNull(),
    unit: text("unit"),
    minValue: real("min_value"),
    maxValue: real("max_value"),
    step: real("step"),
    configJson: text("config_json").notNull().default("{}"),
    archivedAt: text("archived_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_metric_types_user_key").on(table.userId, table.key),
  ]
);

// ── Money realm ──────────────────────────────────────────────────────────
// Ported from the standalone money app. Column names keep their original
// snake_case in SQL so the migrated data lines up row for row; the TS side
// follows this file's camelCase convention.

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    txDate: text("tx_date").notNull(),
    asset: text("asset").notNull(),
    tipo: text("tipo").notNull(),
    derivedType: text("derived_type").notNull(),
    buyValue: real("buy_value").notNull().default(0),
    pnl: real("pnl").notNull().default(0),
    currentValue: real("current_value").notNull().default(0),
    note: text("note"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_tx_user_date").on(table.userId, table.txDate),
  ]
);

export const monthlyMovements = sqliteTable(
  "monthly_movements",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    direction: text("direction").notNull(),
    amount: real("amount").notNull().default(0),
    cadence: text("cadence").notNull().default("monthly"),
    note: text("note"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_mm_user").on(table.userId, table.direction),
    index("idx_mm_user_name").on(table.userId, table.name, table.id),
  ]
);

export const monthlySnapshots = sqliteTable(
  "monthly_snapshots",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    snapshotDate: text("snapshot_date").notNull(),
    lowRisk: real("low_risk").notNull().default(0),
    mediumRisk: real("medium_risk").notNull().default(0),
    highRisk: real("high_risk").notNull().default(0),
    liquid: real("liquid").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_snap_user_date").on(table.userId, table.snapshotDate),
  ]
);

export const assetStyles = sqliteTable(
  "asset_styles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    asset: text("asset").notNull(),
    colorHex: text("color_hex"),
    riskLevel: text("risk_level"),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_asset_styles_user_asset").on(table.userId, table.asset),
  ]
);
