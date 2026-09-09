import { create } from "zustand";
import { z } from "zod";
import { apiEnvelopeSchema } from "../lib";

type User = { id: number; email: string; name: string | null };
type AuthState = { user: User | null; setUser: (user: User | null) => void };
export const useAuthStore = create<AuthState>((set) => ({ user: null, setUser: (user) => set({ user }) }));

export type PainFieldKey = "area" | "symptoms" | "activities" | "medicines" | "habits" | "other";
export type MoodFieldKey = "positive_moods" | "negative_moods" | "general_moods";

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const sessionDataSchema = apiEnvelopeSchema(
  z.object({
    authenticated: z.boolean(),
    user: z.object({ id: z.number(), email: z.string(), name: z.string().nullable() }).optional(),
  }),
);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Mirrors backend/src/schemas.ts registerSchema field for field, including
// the 72-byte bcrypt ceiling and the email fold. A looser copy here does not
// let anything through — it just turns a message the form could have shown
// into a generic 400 from the server.
export const registerSchema = z.object({
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(8, "At least 8 characters").max(72, "At most 72 characters"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((val) => val.newPassword === val.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const diaryEntrySchema = z.object({
  id: z.number(),
  entryDate: z.string(),
  entryTime: z.string(),
  moodLevel: z.number().nullable(),
  depressionLevel: z.number().nullable(),
  anxietyLevel: z.number().nullable(),
  positiveMoods: z.string(),
  negativeMoods: z.string(),
  generalMoods: z.string(),
  description: z.string(),
  gratitude: z.string(),
  reflection: z.string().optional().default(""),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const painEntrySchema = z.object({
  id: z.number(),
  entryDate: z.string(),
  entryTime: z.string(),
  painLevel: z.number().nullable(),
  fatigueLevel: z.number().nullable(),
  coffeeCount: z.number().nullable(),
  area: z.string(),
  symptoms: z.string(),
  activities: z.string(),
  medicines: z.string(),
  habits: z.string(),
  other: z.string(),
  note: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const prefsSchema = apiEnvelopeSchema(
  z.object({
    model: z.string(),
    chatRange: z.string(),
    lastRange: z.string(),
    graphSelection: z.record(z.string(), z.unknown()),
  }),
);

export const memorableDaySchema = z.object({
  id: z.number(),
  date: z.string(),
  title: z.string(),
  emoji: z.string(),
  description: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const memorableDayListSchema = apiEnvelopeSchema(z.array(memorableDaySchema));

/*
 * Every field built on this is a whole-number scale — the nine-step metrics
 * and the coffee count — and the backend says .int() for them, so this does
 * too rather than leaving a half-step to be rejected server-side.
 */
const nullableNumberField = (min: number, max: number) =>
  z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) return null;
      if (typeof value === "number" && Number.isNaN(value)) return null;
      return value;
    },
    z.number().int().min(min).max(max).nullable(),
  );

export const cbtEntrySchema = z.object({
  id: z.number(),
  entryDate: z.string(),
  entryTime: z.string(),
  intensity: z.number().nullable(),
  situation: z.string(),
  thoughts: z.string(),
  mainUnhelpfulThought: z.string(),
  effectOfBelieving: z.string(),
  evidenceForAgainst: z.string(),
  alternativeExplanation: z.string(),
  worstBestScenario: z.string(),
  friendAdvice: z.string(),
  productiveResponse: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const dbtEntrySchema = z.object({
  id: z.number(),
  entryDate: z.string(),
  entryTime: z.string(),
  intensity: z.number().nullable(),
  emotionName: z.string(),
  allowAffirmation: z.string(),
  watchEmotion: z.string(),
  bodyLocation: z.string(),
  bodyFeeling: z.string(),
  presentMoment: z.string(),
  emotionReturns: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const cbtFormSchema = z.object({
  dateTime: z.string().min(1),
  intensity: nullableNumberField(1, 9),
  situation: z.string().default(""),
  thoughts: z.string().default(""),
  mainUnhelpfulThought: z.string().default(""),
  effectOfBelieving: z.string().default(""),
  evidenceForAgainst: z.string().default(""),
  alternativeExplanation: z.string().default(""),
  worstBestScenario: z.string().default(""),
  friendAdvice: z.string().default(""),
  productiveResponse: z.string().default(""),
});

export const dbtFormSchema = z.object({
  dateTime: z.string().min(1),
  intensity: nullableNumberField(1, 9),
  emotionName: z.string().default(""),
  allowAffirmation: z.string().default(""),
  watchEmotion: z.string().default(""),
  bodyLocation: z.string().default(""),
  bodyFeeling: z.string().default(""),
  presentMoment: z.string().default(""),
  emotionReturns: z.string().default(""),
});

export const diaryListSchema = apiEnvelopeSchema(z.array(diaryEntrySchema));
export const painListSchema = apiEnvelopeSchema(z.array(painEntrySchema));
export const cbtListSchema = apiEnvelopeSchema(z.array(cbtEntrySchema));
export const dbtListSchema = apiEnvelopeSchema(z.array(dbtEntrySchema));
export const painOptionsSchema = apiEnvelopeSchema(
  z.object({
    area: z.array(z.string()),
    symptoms: z.array(z.string()),
    activities: z.array(z.string()),
    medicines: z.array(z.string()),
    habits: z.array(z.string()),
    other: z.array(z.string()),
    preselectedMedicines: z.array(z.string()),
  }),
);

export const moodOptionsSchema = apiEnvelopeSchema(
  z.object({
    positive_moods: z.array(z.string()),
    negative_moods: z.array(z.string()),
    general_moods: z.array(z.string()),
  }),
);

export const diaryFormSchema = z.object({
  dateTime: z.string().min(1),
  moodLevel: nullableNumberField(1, 9),
  depressionLevel: nullableNumberField(1, 9),
  anxietyLevel: nullableNumberField(1, 9),
  positiveMoods: z.string().default(""),
  negativeMoods: z.string().default(""),
  generalMoods: z.string().default(""),
  description: z.string().default(""),
  gratitude: z.string().default(""),
});

export const painFormSchema = z.object({
  dateTime: z.string().min(1),
  painLevel: nullableNumberField(1, 9),
  fatigueLevel: nullableNumberField(1, 9),
  coffeeCount: nullableNumberField(0, 50),
  area: z.string().default(""),
  symptoms: z.string().default(""),
  activities: z.string().default(""),
  medicines: z.string().default(""),
  habits: z.string().default(""),
  other: z.string().default(""),
  note: z.string().default(""),
});

export type DiaryEntry = z.infer<typeof diaryEntrySchema>;
export type PainEntry = z.infer<typeof painEntrySchema>;
export type CbtEntry = z.infer<typeof cbtEntrySchema>;
export type DbtEntry = z.infer<typeof dbtEntrySchema>;
export type MemorableDay = z.infer<typeof memorableDaySchema>;
export type DiaryFormValues = z.infer<typeof diaryFormSchema>;
export type PainFormValues = z.infer<typeof painFormSchema>;
export type CbtFormValues = z.infer<typeof cbtFormSchema>;
export type DbtFormValues = z.infer<typeof dbtFormSchema>;

export const navItems = [
  "dashboard", "memorable-days", "diary", "pain", "cbt", "dbt",
  "money-dashboard", "money-transactions", "money-movements", "money-snapshots",
  "settings-account", "settings-appearance", "settings-health", "settings-money", "settings-design-system",
] as const;
export type NavItem = (typeof navItems)[number];

export const navLabels: Record<NavItem, string> = {
  dashboard: "Dashboard",
  "memorable-days": "Memorable days",
  diary: "Diary",
  pain: "Pain",
  cbt: "CBT",
  dbt: "DBT",
  "money-dashboard": "Dashboard",
  "money-transactions": "Transactions",
  "money-movements": "Movements",
  "money-snapshots": "Snapshots",
  "settings-account": "Account",
  "settings-appearance": "Appearance",
  "settings-health": "Health",
  "settings-money": "Money",
  "settings-design-system": "Design System",
};

/*
 * The app is a set of realms behind one shell and one login. A realm owns its
 * nav list, its accent (see :root[data-realm] in styles.css) and its title.
 * Settings is a realm too, rather than a page hanging off the others: that
 * keeps every nav item inside exactly one realm, so the active realm stays
 * derivable from the nav item and there is no second piece of state that
 * could drift out of sync with it.
 */
export const realms = ["health", "money", "settings"] as const;
export type Realm = (typeof realms)[number];
export const DEFAULT_REALM: Realm = "health";
export const REALM_STORAGE_KEY = "world-realm";

/*
 * What the two views are called, per screen. One map so the page and the
 * mobile sticky head — which render the same control in two places —
 * cannot drift apart. Movements says "Recurring" because its list is
 * active state, not a past log.
 */
export const entryViewLabels = {
  pain: { newEntry: "New entry", history: "History" },
  diary: { newEntry: "New entry", history: "History" },
  cbt: { newEntry: "New entry", history: "History" },
  dbt: { newEntry: "New entry", history: "History" },
  "money-transactions": { newEntry: "New transaction", history: "History" },
  "money-movements": { newEntry: "New movement", history: "Recurring" },
  "money-snapshots": { newEntry: "New snapshot", history: "History" },
} satisfies Partial<Record<NavItem, { newEntry: string; history: string }>>;

/** The screens that split into a form and a log — exactly the keys above. */
export type EntryViewPage = keyof typeof entryViewLabels;

export function hasEntryViews(nav: NavItem): nav is EntryViewPage {
  return nav in entryViewLabels;
}

export const realmLabels: Record<Realm, string> = { health: "Health", money: "Money", settings: "Settings" };

export const navItemsByRealm: Record<Realm, NavItem[]> = {
  health: ["dashboard", "pain", "diary", "cbt", "dbt", "memorable-days"],
  money: ["money-dashboard", "money-transactions", "money-movements", "money-snapshots"],
  settings: ["settings-account", "settings-appearance", "settings-health", "settings-money", "settings-design-system"],
};

// Health owns the unprefixed items because it was here first; every realm
// added since carries its own prefix.
export function realmOf(nav: NavItem): Realm {
  if (nav.startsWith("money-")) return "money";
  if (nav.startsWith("settings-")) return "settings";
  return "health";
}

export function readStoredRealm(): Realm {
  try {
    const stored = localStorage.getItem(REALM_STORAGE_KEY);
    if (stored && (realms as readonly string[]).includes(stored)) {
      return stored as Realm;
    }
  } catch {
    // localStorage unavailable (private mode, disabled) — fall back to default.
  }
  return DEFAULT_REALM;
}

export const APP_NAME = "World";

// Inside a realm the title names the realm ("Diary - Health"); outside one —
// the sign-in screen, before a realm is picked — it names the app.
export function formatDocumentTitle(section?: string, realm?: Realm) {
  const name = realm ? realmLabels[realm] : APP_NAME;
  return section ? `${section} - ${name}` : name;
}

export const dashboardQuickRanges = [
  { value: "7", label: "1 week" },
  { value: "30", label: "1 month" },
  { value: "90", label: "3 months" },
  { value: "180", label: "6 months" },
  { value: "365", label: "1 year" },
  { value: "1095", label: "3 years" },
  { value: "all", label: "Since start" },
] as const;
export type DashboardQuickRange = (typeof dashboardQuickRanges)[number]["value"];

export const wellbeingSeriesKeys = ["pain", "fatigue", "mood", "depression", "anxiety"] as const;
export type WellbeingSeriesKey = (typeof wellbeingSeriesKeys)[number];

export const wellbeingGraphId = "graph-wellbeing";
export const defaultPrefsValue = {
  // model and chatRange are kept for backwards compatibility with the
  // user_preferences DB columns but no longer surfaced in the UI.
  model: "",
  chatRange: "all",
  lastRange: "all",
  graphSelection: {},
};

export function formatMonthLabel(value: Date) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(value);
}

export const THEME_STORAGE_KEY = "world-theme";
export const themeIds = ["dark", "grey", "oled"] as const;
export type ThemeId = (typeof themeIds)[number];
export const DEFAULT_THEME: ThemeId = "dark";
// `bg` previews each theme as a swatch without mounting it; the value mirrors
// the theme's --bg token in styles.css and is guarded by a test.
export const THEMES: { id: ThemeId; label: string; bg: string; card: string; text: string; hint: string }[] = [
  { id: "dark", label: "Dark", bg: "#121214", card: "#161619", text: "#f5f5f7", hint: "Default" },
  { id: "grey", label: "Grey", bg: "#1f1f23", card: "#2a2a30", text: "#f5f5f7", hint: "Flat surfaces, softer contrast" },
  { id: "oled", label: "OLED", bg: "#000000", card: "#0c0c0e", text: "#c9c9ce", hint: "True black, dimmed text" },
];

export function toDateKey(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function isSameMonth(anchorDate: string, monthDate: Date) {
  const [year, month] = anchorDate.split("-").map(Number);
  return year === monthDate.getFullYear() && month === monthDate.getMonth() + 1;
}

export const defaultWellbeingSelection: Record<WellbeingSeriesKey, boolean> = {
  pain: true,
  fatigue: true,
  mood: true,
  depression: true,
  anxiety: true,
};

export type DashboardCard = {
  label: string;
  emoji: string;
  value: number | null;
  formattedValue: string;
  previous: number | null;
  invertDelta?: boolean;
  /** The one the dashboard leads with. */
  primary?: boolean;
};

export type DashboardInsight = {
  title: string;
  detail: string;
};

export type DashboardConnectionConfidence = "weak" | "medium" | "strong";

export type DashboardConnection = {
  title: string;
  summary: string;
  detail: string;
  confidence: DashboardConnectionConfidence;
};

export type SeriesPoint = { date: string; value: number };
export type WellbeingSeries = {
  key: WellbeingSeriesKey;
  label: string;
  color: string;
  points: SeriesPoint[];
};

export type InlineMessageTone = "error" | "success" | "warning" | "info";
export type InlineMessage = {
  tone: InlineMessageTone;
  text: string;
};

export const BACKUP_JSON_EXPORT_OK: InlineMessage = { tone: "info", text: "JSON export started." };
export const BACKUP_JSON_IMPORT_OK: InlineMessage = { tone: "success", text: "JSON import completed." };
export const BACKUP_XLSX_EXPORT_OK: InlineMessage = { tone: "info", text: "Spreadsheet export started." };
export const BACKUP_XLSX_IMPORT_OK: InlineMessage = { tone: "success", text: "Spreadsheet import completed." };

export function inDateRange(dateValue: string, from: string, to: string): boolean {
  if (!dateValue) return false;
  if (from && dateValue < from) return false;
  if (to && dateValue > to) return false;
  return true;
}

export function average(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!filtered.length) {
    return null;
  }
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

export function formatNumber(value: number | null, digits = 2): string {
  if (value === null) {
    return "–";
  }
  return value.toFixed(digits);
}

export function formatDelta(value: number, invert = false): { text: string; className: string } | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Number(value.toFixed(0));
  if (!Number.isFinite(rounded)) return null;
  const positive = invert ? rounded < 0 : rounded > 0;
  const negative = invert ? rounded > 0 : rounded < 0;
  return {
    text: `${rounded > 0 ? "+" : ""}${rounded}%`,
    className: positive ? "positive" : negative ? "negative" : "neutral",
  };
}

export function calcDeltaPercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getDeltaSemantic(): Record<string, { color: string; border: string; bg: string }> {
  const success = getCssVar("--success") || "#6fe1b0";
  const muted = getCssVar("--muted") || "#a1a1ad";
  // No token for negative delta color (#ff8fb1 — lighter pink distinct from --danger/#ff5a7f and --accent/#ff5e8a)
  const negativeFallback = "#ff8fb1";
  return {
    positive: { color: success, border: hexToRgba(success, 0.5), bg: hexToRgba(success, 0.09) },
    negative: { color: negativeFallback, border: hexToRgba(negativeFallback, 0.5), bg: hexToRgba(negativeFallback, 0.1) },
    neutral: { color: muted, border: "var(--border)", bg: "rgba(255, 255, 255, 0.03)" },
  };
}

function getDeltaWhite(): string {
  return getCssVar("--text") || "#f5f5f7";
}

function blend(a: number, b: number, t: number) {
  return Math.round(a * t + b * (1 - t));
}

function blendHex(hexA: string, hexB: string, t: number): string {
  const parse = (h: string) => ({
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  });
  const pa = parse(hexA);
  const pb = parse(hexB);
  const hr = (x: number) => x.toString(16).padStart(2, "0");
  return `#${hr(blend(pa.r, pb.r, t))}${hr(blend(pa.g, pb.g, t))}${hr(blend(pa.b, pb.b, t))}`;
}

export function getDeltaStyle(className: string, absPct: number): React.CSSProperties {
  const deltaSemantic = getDeltaSemantic();
  const semantic = deltaSemantic[className] ?? deltaSemantic.neutral;
  const deltaWhite = getDeltaWhite();
  const deltaWhiteBorder = hexToRgba(deltaWhite, 0.4);
  const deltaWhiteBg = hexToRgba(deltaWhite, 0.06);
  const t = Math.max(0, Math.min(1, 1 - absPct / 15));
  const useWhiteStyle = t > 0.5;
  return {
    color: blendHex(deltaWhite, semantic.color, t),
    borderColor: useWhiteStyle ? deltaWhiteBorder : semantic.border,
    backgroundColor: useWhiteStyle ? deltaWhiteBg : semantic.bg,
  };
}

/**
 * The window of the same length that ends the day before `from`. Both
 * bounds are inclusive calendar days; an empty `to` means today. Computed
 * on UTC midnights so neither the timezone nor a DST switch can move a day.
 */
export function previousRange(from: string, to: string): { from: string; to: string } | null {
  if (!from) {
    return null;
  }
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to || toDateKey(new Date())}T00:00:00Z`);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    return null;
  }
  const days = Math.round((toMs - fromMs) / MS_PER_DAY) + 1;
  if (days <= 0) {
    return null;
  }
  const prevToMs = fromMs - MS_PER_DAY;
  const prevFromMs = prevToMs - (days - 1) * MS_PER_DAY;
  return { from: new Date(prevFromMs).toISOString().slice(0, 10), to: new Date(prevToMs).toISOString().slice(0, 10) };
}

export function buildDailyAverages<T>(
  rows: T[],
  getDate: (row: T) => string,
  getValue: (row: T) => number | null | undefined,
): SeriesPoint[] {
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const date = getDate(row);
    const value = getValue(row);
    if (!date || typeof value !== "number" || !Number.isFinite(value)) {
      continue;
    }
    const current = buckets.get(date) ?? { sum: 0, count: 0 };
    current.sum += value;
    current.count += 1;
    buckets.set(date, current);
  }

  return Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, stats]) => ({ date, value: stats.sum / stats.count }));
}

export function extractWellbeingSelection(rawGraphSelection: Record<string, unknown> | undefined): Record<WellbeingSeriesKey, boolean> {
  const out: Record<WellbeingSeriesKey, boolean> = { ...defaultWellbeingSelection };
  const graphNode = rawGraphSelection?.[wellbeingGraphId];
  if (!graphNode || typeof graphNode !== "object") {
    return out;
  }
  const node = graphNode as Record<string, unknown>;
  for (const key of wellbeingSeriesKeys) {
    if (typeof node[key] === "boolean") {
      out[key] = node[key];
    }
  }
  return out;
}

export function csvToList(input?: string): string[] {
  if (!input) return [];
  const values = input
    .split(/,\s*/)
    .map((value) => value.trim())
    .filter(Boolean);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(value);
  }
  return unique;
}

export function listToCsv(values: string[]): string {
  return csvToList(values.join(",")).join(", ");
}

export function mergeOptions(...collections: Array<string[] | undefined>): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const collection of collections) {
    for (const value of collection ?? []) {
      const clean = value.trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(clean);
    }
  }
  return unique;
}

export function normalizeQuickRange(value: unknown): DashboardQuickRange {
  const str = String(value ?? "").trim();
  if (dashboardQuickRanges.some((item) => item.value === str)) {
    return str as DashboardQuickRange;
  }
  return "all";
}

export function getQuickRangeBounds(range: DashboardQuickRange): { from: string; to: string } {
  if (range === "all") {
    return { from: "", to: "" };
  }
  const days = Number(range);
  const now = new Date();
  const from = new Date(now.getTime() - days * MS_PER_DAY);
  return { from: toDateKey(from), to: toDateKey(now) };
}
