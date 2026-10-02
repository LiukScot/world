export const SCHEMA_VERSION = 19;

export const METRIC_KINDS = ["scale", "counter", "tags", "text", "measure"] as const;
export type MetricKind = (typeof METRIC_KINDS)[number];

export type BuiltinMetricType = {
  key: string;
  label: string;
  kind: MetricKind;
  unit: string | null;
  min: number | null;
  max: number | null;
  step: number | null;
};

// Built-in metric types seeded per user. Single source of truth for both
// the seed SQL (built below) and the seed test, so they can never drift.
export const BUILTIN_METRIC_TYPES: readonly BuiltinMetricType[] = [
  // scales (1-9)
  { key: "mood", label: "Mood", kind: "scale", unit: null, min: 1, max: 9, step: 1 },
  { key: "depression", label: "Depression", kind: "scale", unit: null, min: 1, max: 9, step: 1 },
  { key: "anxiety", label: "Anxiety", kind: "scale", unit: null, min: 1, max: 9, step: 1 },
  { key: "pain", label: "Pain", kind: "scale", unit: null, min: 1, max: 9, step: 1 },
  { key: "fatigue", label: "Fatigue", kind: "scale", unit: null, min: 1, max: 9, step: 1 },
  // counter
  { key: "coffee", label: "Coffee", kind: "counter", unit: null, min: 0, max: null, step: 1 },
  // tags
  { key: "positive_moods", label: "Positive moods", kind: "tags", unit: null, min: null, max: null, step: null },
  { key: "negative_moods", label: "Negative moods", kind: "tags", unit: null, min: null, max: null, step: null },
  { key: "general_moods", label: "General moods", kind: "tags", unit: null, min: null, max: null, step: null },
  { key: "area", label: "Area", kind: "tags", unit: null, min: null, max: null, step: null },
  { key: "symptoms", label: "Symptoms", kind: "tags", unit: null, min: null, max: null, step: null },
  { key: "activities", label: "Activities", kind: "tags", unit: null, min: null, max: null, step: null },
  { key: "medicines", label: "Medicines", kind: "tags", unit: null, min: null, max: null, step: null },
  { key: "habits", label: "Habits", kind: "tags", unit: null, min: null, max: null, step: null },
  { key: "other", label: "Other", kind: "tags", unit: null, min: null, max: null, step: null },
  // free-text fields (diary / pain)
  { key: "description", label: "Description", kind: "text", unit: null, min: null, max: null, step: null },
  { key: "gratitude", label: "Gratitude", kind: "text", unit: null, min: null, max: null, step: null },
  { key: "note", label: "Note", kind: "text", unit: null, min: null, max: null, step: null },
  // CBT therapy fields (text)
  { key: "cbt_situation", label: "Situation", kind: "text", unit: null, min: null, max: null, step: null },
  { key: "cbt_thoughts", label: "Thoughts", kind: "text", unit: null, min: null, max: null, step: null },
  { key: "cbt_main_unhelpful_thought", label: "Main unhelpful thought", kind: "text", unit: null, min: null, max: null, step: null },
  { key: "cbt_effect_of_believing", label: "Effect of believing", kind: "text", unit: null, min: null, max: null, step: null },
  { key: "cbt_evidence_for_against", label: "Evidence for & against", kind: "text", unit: null, min: null, max: null, step: null },
  { key: "cbt_alternative_explanation", label: "Alternative explanation", kind: "text", unit: null, min: null, max: null, step: null },
  { key: "cbt_worst_best_scenario", label: "Worst & best scenario", kind: "text", unit: null, min: null, max: null, step: null },
  { key: "cbt_friend_advice", label: "Friend's advice", kind: "text", unit: null, min: null, max: null, step: null },
  { key: "cbt_productive_response", label: "Productive response", kind: "text", unit: null, min: null, max: null, step: null },
  // DBT therapy fields (text)
  { key: "dbt_emotion_name", label: "Emotion name", kind: "text", unit: null, min: null, max: null, step: null },
  { key: "dbt_allow_affirmation", label: "Allow affirmation", kind: "text", unit: null, min: null, max: null, step: null },
  { key: "dbt_watch_emotion", label: "Watch the emotion", kind: "text", unit: null, min: null, max: null, step: null },
  { key: "dbt_body_location", label: "Body location", kind: "text", unit: null, min: null, max: null, step: null },
  { key: "dbt_body_feeling", label: "Body feeling", kind: "text", unit: null, min: null, max: null, step: null },
  { key: "dbt_present_moment", label: "Present moment", kind: "text", unit: null, min: null, max: null, step: null },
  { key: "dbt_emotion_returns", label: "Emotion returns", kind: "text", unit: null, min: null, max: null, step: null },
  // generic starters for custom pages
  { key: "free_text", label: "Free text", kind: "text", unit: null, min: null, max: null, step: null },
  { key: "measurement", label: "Measurement", kind: "measure", unit: null, min: null, max: null, step: null },
];

function metricTypeSeedRow(m: BuiltinMetricType): string {
  const str = (v: string | null) => (v === null ? "NULL" : `'${v.replace(/'/g, "''")}'`);
  const num = (v: number | null) => (v === null ? "NULL" : String(v));
  return `SELECT ${str(m.key)} AS key, ${str(m.label)} AS label, ${str(m.kind)} AS kind, ${str(m.unit)} AS unit, ${num(m.min)} AS min_value, ${num(m.max)} AS max_value, ${num(m.step)} AS step`;
}

// INSERT OR IGNORE + the UNIQUE(user_id, key) index make this idempotent,
// matching the mood_options/pain_options seeding pattern. The SQL is
// string-built from BUILTIN_METRIC_TYPES (static developer data, never
// user input) with single quotes escaped, so it is not an injection surface.
function buildMetricTypesSeedSql(): string {
  const values = BUILTIN_METRIC_TYPES.map(metricTypeSeedRow).join("\n     UNION ALL\n     ");
  return `INSERT OR IGNORE INTO metric_types (user_id, key, label, kind, unit, min_value, max_value, step)
   SELECT u.id, v.key, v.label, v.kind, v.unit, v.min_value, v.max_value, v.step
   FROM users u
   CROSS JOIN (
     ${values}
   ) AS v`;
}

export const migrationStatements: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    disabled_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS diary_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    entry_date TEXT NOT NULL,
    entry_time TEXT NOT NULL,
    mood_level INTEGER,
    depression_level INTEGER,
    anxiety_level INTEGER,
    description TEXT,
    gratitude TEXT,
    reflection TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS pain_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    entry_date TEXT NOT NULL,
    entry_time TEXT NOT NULL,
    pain_level INTEGER,
    fatigue_level INTEGER,
    coffee_count INTEGER,
    area TEXT NOT NULL DEFAULT '',
    symptoms TEXT NOT NULL DEFAULT '',
    activities TEXT NOT NULL DEFAULT '',
    medicines TEXT NOT NULL DEFAULT '',
    habits TEXT NOT NULL DEFAULT '',
    other TEXT NOT NULL DEFAULT '',
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INTEGER PRIMARY KEY,
    model TEXT NOT NULL DEFAULT 'mistral-small-latest',
    chat_range TEXT NOT NULL DEFAULT 'all',
    last_range TEXT NOT NULL DEFAULT 'all',
    graph_selection_json TEXT NOT NULL DEFAULT '{}',
    show_zero_assets INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  // schema-v12: show_zero_assets added to CREATE TABLE above; ALTER TABLE for
  // existing databases is handled separately in db.ts via columnExists guard,
  // which also drops the columns left by removed features (birthday,
  // repeat_mode).
  `CREATE TABLE IF NOT EXISTS memorable_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    title TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_memorable_days_user_date ON memorable_days(user_id, date DESC, id DESC)`,
  // user_ai_settings dropped with the Mistral chatbot.
  `DROP TABLE IF EXISTS user_ai_settings`,
  `CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_diary_user_date ON diary_entries(user_id, entry_date DESC, entry_time DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_pain_user_date ON pain_entries(user_id, entry_date DESC, entry_time DESC)`,
  `CREATE TABLE IF NOT EXISTS pain_removed_options (
    user_id INTEGER NOT NULL,
    field TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (user_id, field, value),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS pain_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    field TEXT NOT NULL,
    value TEXT NOT NULL,
    preselected INTEGER NOT NULL DEFAULT 1,
    UNIQUE(user_id, field, value),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  // schema-v10: preselected column added to pain_options. ALTER TABLE for
  // existing databases is handled separately in db.ts via columnExists guard.
  `CREATE TABLE IF NOT EXISTS mood_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    field TEXT NOT NULL,
    value TEXT NOT NULL,
    UNIQUE(user_id, field, value),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS mood_removed_options (
    user_id INTEGER NOT NULL,
    field TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (user_id, field, value),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `INSERT OR IGNORE INTO mood_options (user_id, field, value)
   SELECT u.id, v.field, v.value
   FROM users u
   CROSS JOIN (
     SELECT 'positive_moods'  AS field, 'happy'       AS value UNION ALL
     SELECT 'positive_moods',           'calm'                  UNION ALL
     SELECT 'positive_moods',           'grateful'              UNION ALL
     SELECT 'positive_moods',           'energetic'             UNION ALL
     SELECT 'positive_moods',           'hopeful'               UNION ALL
     SELECT 'positive_moods',           'relaxed'               UNION ALL
     SELECT 'positive_moods',           'confident'             UNION ALL
     SELECT 'negative_moods',           'sad'                   UNION ALL
     SELECT 'negative_moods',           'angry'                 UNION ALL
     SELECT 'negative_moods',           'frustrated'            UNION ALL
     SELECT 'negative_moods',           'lonely'                UNION ALL
     SELECT 'negative_moods',           'overwhelmed'           UNION ALL
     SELECT 'negative_moods',           'irritable'             UNION ALL
     SELECT 'negative_moods',           'hopeless'              UNION ALL
     SELECT 'general_moods',            'tired'                 UNION ALL
     SELECT 'general_moods',            'numb'                  UNION ALL
     SELECT 'general_moods',            'distracted'            UNION ALL
     SELECT 'general_moods',            'restless'              UNION ALL
     SELECT 'general_moods',            'bored'                 UNION ALL
     SELECT 'general_moods',            'indifferent'
   ) AS v`,
  `INSERT OR IGNORE INTO pain_options (user_id, field, value)
   SELECT u.id, v.field, v.value
   FROM users u
   CROSS JOIN (
     SELECT 'area'       AS field, 'tmj'                    AS value UNION ALL
     SELECT 'area',                'legs'                            UNION ALL
     SELECT 'area',                'shoulders'                       UNION ALL
     SELECT 'area',                'chest'                           UNION ALL
     SELECT 'area',                'neck'                            UNION ALL
     SELECT 'area',                'head'                            UNION ALL
     SELECT 'area',                'back'                            UNION ALL
     SELECT 'area',                'abdomen'                         UNION ALL
     SELECT 'symptoms',            'running nose'                    UNION ALL
     SELECT 'symptoms',            'coughing'                        UNION ALL
     SELECT 'symptoms',            'nausea'                          UNION ALL
     SELECT 'symptoms',            'short breath'                    UNION ALL
     SELECT 'symptoms',            'diarrhea'                        UNION ALL
     SELECT 'symptoms',            'stiffness'                       UNION ALL
     SELECT 'symptoms',            'palpitation'                     UNION ALL
     SELECT 'symptoms',            'fever'                           UNION ALL
     SELECT 'symptoms',            'frequent piss'                   UNION ALL
     SELECT 'symptoms',            'itching'                         UNION ALL
     SELECT 'symptoms',            'pins & needles'                  UNION ALL
     SELECT 'symptoms',            'cramps'                          UNION ALL
     SELECT 'symptoms',            'salivation'                      UNION ALL
     SELECT 'symptoms',            'vomit'                           UNION ALL
     SELECT 'activities',          'sit for a long time'             UNION ALL
     SELECT 'activities',          'lay down for a long time'        UNION ALL
     SELECT 'activities',          'outside'                         UNION ALL
     SELECT 'activities',          'walk'                            UNION ALL
     SELECT 'activities',          'heavy strain'                    UNION ALL
     SELECT 'activities',          'stand up for a long time'        UNION ALL
     SELECT 'activities',          'work'                            UNION ALL
     SELECT 'activities',          'hyperfocus'                      UNION ALL
     SELECT 'activities',          'stretch'                         UNION ALL
     SELECT 'activities',          'breathing'                       UNION ALL
     SELECT 'activities',          'photography'                     UNION ALL
     SELECT 'activities',          'bath'                            UNION ALL
     SELECT 'activities',          'nap'                             UNION ALL
     SELECT 'medicines',           '200mg celebrex'                  UNION ALL
     SELECT 'medicines',           '4mg sirdalud'                    UNION ALL
     SELECT 'habits',              'good sleep'                      UNION ALL
     SELECT 'habits',              'healthy food'                    UNION ALL
     SELECT 'other',               '>6h day byte'                    UNION ALL
     SELECT 'other',               'cum'                             UNION ALL
     SELECT 'other',               '>12h day byte'                   UNION ALL
     SELECT 'other',               '<1h masturbation'                UNION ALL
     SELECT 'other',               '>1h masturbation'
   ) AS v`,
  `CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS cbt_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    entry_date TEXT NOT NULL,
    entry_time TEXT NOT NULL,
    intensity INTEGER,
    situation TEXT NOT NULL DEFAULT '',
    thoughts TEXT NOT NULL DEFAULT '',
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
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cbt_user_date ON cbt_entries(user_id, entry_date DESC, entry_time DESC)`,
  `CREATE TABLE IF NOT EXISTS dbt_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    entry_date TEXT NOT NULL,
    entry_time TEXT NOT NULL,
    intensity INTEGER,
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
  )`,
  `CREATE INDEX IF NOT EXISTS idx_dbt_user_date ON dbt_entries(user_id, entry_date DESC, entry_time DESC)`,

  // The MCP server and its personal access tokens were removed; the table
  // goes with them. One-way on purpose — the tokens were credentials, and
  // reissuing them is cheaper than keeping dead hashes around.
  `DROP INDEX IF EXISTS idx_mcp_tokens_user`,
  `DROP TABLE IF EXISTS mcp_tokens`,

  // ── metric_types: modular value-type definitions (built-in + custom) ────
  `CREATE TABLE IF NOT EXISTS metric_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    label TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN (${METRIC_KINDS.map((k) => `'${k}'`).join(", ")})),
    unit TEXT,
    min_value REAL,
    max_value REAL,
    step REAL,
    config_json TEXT NOT NULL DEFAULT '{}',
    archived_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_types_user_key ON metric_types(user_id, key)`,
  buildMetricTypesSeedSql(),

  // ── Money realm ────────────────────────────────────────────────────────
  // Ported from the standalone money app. Table names are kept unprefixed to
  // match the health tables next to them, and because none of them collide.
  // Money's own users/sessions tables are gone: both realms share this DB's
  // users and sessions. Its show_zero_assets preference moved into
  // user_preferences above rather than getting a second preferences table.
  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    tx_date TEXT NOT NULL,
    asset TEXT NOT NULL,
    tipo TEXT NOT NULL,
    derived_type TEXT NOT NULL,
    buy_value REAL NOT NULL DEFAULT 0,
    pnl REAL NOT NULL DEFAULT 0,
    current_value REAL NOT NULL DEFAULT 0,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, tx_date DESC)`,
  `CREATE TABLE IF NOT EXISTS monthly_movements (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    direction TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    cadence TEXT NOT NULL DEFAULT 'monthly',
    note TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mm_user ON monthly_movements(user_id, direction)`,
  `CREATE INDEX IF NOT EXISTS idx_mm_user_name ON monthly_movements(user_id, name, id)`,
  // schema-v13: cadence column added to CREATE TABLE above. ALTER TABLE for
  // existing databases is handled separately in db.ts via columnExists guard.
  `CREATE TABLE IF NOT EXISTS monthly_snapshots (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    snapshot_date TEXT NOT NULL,
    low_risk REAL NOT NULL DEFAULT 0,
    medium_risk REAL NOT NULL DEFAULT 0,
    high_risk REAL NOT NULL DEFAULT 0,
    liquid REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_snap_user_date ON monthly_snapshots(user_id, snapshot_date DESC)`,
  `CREATE TABLE IF NOT EXISTS asset_styles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    asset TEXT NOT NULL,
    color_hex TEXT,
    risk_level TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_styles_user_asset ON asset_styles(user_id, asset)`,
];

export const TAG_TYPES = ["area", "symptoms", "activities", "medicines", "habits", "other"] as const;
export type TagType = (typeof TAG_TYPES)[number];

export const MOOD_TAG_FIELDS = ["positive_moods", "negative_moods", "general_moods"] as const;
export type MoodTagField = (typeof MOOD_TAG_FIELDS)[number];
