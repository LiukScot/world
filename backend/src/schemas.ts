import { z } from "zod";

export const DEFAULT_MODEL = "mistral-small-latest";

function isoDateRefine(val: string): boolean {
  const parsed = new Date(val);
  if (isNaN(parsed.getTime())) return false;
  const [year, month, day] = val.split("-").map(Number);
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day;
}

/*
 * Emails are stored folded — user-cli has always done it on create, and now
 * registration does too — so the lookup has to fold as well or an account
 * created as "Me@Example.com" could never be signed into.
 */
const emailField = z.string().trim().email().max(254).transform((v) => v.toLowerCase());

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1).max(72)
});

/*
 * The 72-byte cap is bcrypt's, kept so a password set here still verifies
 * against a legacy hash. The 8-char floor matches change-password: a new
 * account should not be allowed to start weaker than an existing one is
 * allowed to become.
 */
export const registerSchema = z.object({
  email: emailField,
  password: z.string().min(8).max(72),
  name: z.string().trim().max(120).optional().default("")
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(8).max(72)
});

export const diarySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entryTime: z.string().regex(/^\d{2}:\d{2}$/),
  moodLevel: z.number().min(1).max(9).nullable().optional(),
  depressionLevel: z.number().min(1).max(9).nullable().optional(),
  anxietyLevel: z.number().min(1).max(9).nullable().optional(),
  positiveMoods: z.string().max(2000).optional().default(""),
  negativeMoods: z.string().max(2000).optional().default(""),
  generalMoods: z.string().max(2000).optional().default(""),
  description: z.string().max(10000).optional().default(""),
  gratitude: z.string().max(10000).optional().default(""),
  reflection: z.string().max(10000).optional()
});

export const painValueSchema = z.union([z.string(), z.array(z.string())]).optional();

export const painSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entryTime: z.string().regex(/^\d{2}:\d{2}$/),
  painLevel: z.number().int().min(1).max(9).nullable().optional(),
  fatigueLevel: z.number().int().min(1).max(9).nullable().optional(),
  coffeeCount: z.number().int().min(0).max(50).nullable().optional(),
  area: painValueSchema,
  symptoms: painValueSchema,
  activities: painValueSchema,
  medicines: painValueSchema,
  habits: painValueSchema,
  other: painValueSchema,
  note: z.string().max(2000).optional().default(""),
  tags: z
    .object({
      area: z.array(z.string()).optional(),
      symptoms: z.array(z.string()).optional(),
      activities: z.array(z.string()).optional(),
      medicines: z.array(z.string()).optional(),
      habits: z.array(z.string()).optional(),
      other: z.array(z.string()).optional()
    })
    .partial()
    .optional()
});

export const cbtSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entryTime: z.string().regex(/^\d{2}:\d{2}$/),
  intensity: z.number().int().min(1).max(9).nullable().optional(),
  situation: z.string().max(5000).optional().default(""),
  thoughts: z.string().max(5000).optional().default(""),
  mainUnhelpfulThought: z.string().max(5000).optional().default(""),
  effectOfBelieving: z.string().max(5000).optional().default(""),
  evidenceForAgainst: z.string().max(5000).optional().default(""),
  alternativeExplanation: z.string().max(5000).optional().default(""),
  worstBestScenario: z.string().max(5000).optional().default(""),
  friendAdvice: z.string().max(5000).optional().default(""),
  productiveResponse: z.string().max(5000).optional().default(""),
});

export const dbtSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entryTime: z.string().regex(/^\d{2}:\d{2}$/),
  intensity: z.number().int().min(1).max(9).nullable().optional(),
  emotionName: z.string().max(200).optional().default(""),
  allowAffirmation: z.string().max(5000).optional().default(""),
  watchEmotion: z.string().max(5000).optional().default(""),
  bodyLocation: z.string().max(500).optional().default(""),
  bodyFeeling: z.string().max(5000).optional().default(""),
  presentMoment: z.string().max(5000).optional().default(""),
  emotionReturns: z.string().max(5000).optional().default(""),
});

export const prefsSchema = z.object({
  model: z.string().max(200).default(DEFAULT_MODEL),
  chatRange: z.string().max(50).default("all"),
  lastRange: z.string().max(50).default("all"),
  graphSelection: z.record(z.string(), z.unknown()).default({}),
});

export const memorableDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isoDateRefine, {
    message: "Invalid date: must be a valid calendar date in YYYY-MM-DD format"
  }),
  title: z.string().trim().min(1).max(120),
  emoji: z.string().trim().max(16).optional().default(""),
  description: z.string().max(1000).optional().default(""),
});

const BACKUP_MAX_ROWS = 50_000;

export const backupImportSchema = z.object({
  diary: z
    .object({
      rows: z.array(z.record(z.string(), z.unknown())).max(BACKUP_MAX_ROWS).default([]),
      moodOptions: z.record(z.string(), z.array(z.string())).optional()
    })
    .optional(),
  pain: z
    .object({
      rows: z.array(z.record(z.string(), z.unknown())).max(BACKUP_MAX_ROWS).default([]),
      options: z
        .object({
          options: z.record(z.string(), z.array(z.string())).optional(),
          removed: z.record(z.string(), z.array(z.string())).optional(),
          preselectedMedicines: z.array(z.string()).optional()
        })
        .optional()
    })
    .optional(),
  prefs: prefsSchema.optional()
});

export const optionFieldSchema = z.object({
  field: z.string(),
  value: z.string().min(1)
});

export const optionPreselectSchema = z.object({
  field: z.string(),
  value: z.string().min(1),
  preselected: z.boolean()
});

// ── Money realm ──────────────────────────────────────────────────────────

const moneyIsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").refine(isoDateRefine, {
  message: "Invalid calendar date"
});

export const txSchema = z.object({
  txDate: moneyIsoDate,
  asset: z.string().min(1).max(120),
  tipo: z.string().min(1).max(60),
  derivedType: z.string().max(40).optional(),
  buyValue: z.coerce.number().default(0),
  pnl: z.coerce.number().default(0),
  currentValue: z.coerce.number().optional(),
  note: z.string().max(2000).default("")
});

export const MOVEMENT_CADENCES = ["monthly", "annual"] as const;

export const movementSchema = z.object({
  name: z.string().min(1).max(120),
  direction: z.enum(["income", "expense"]),
  amount: z.coerce.number().nonnegative(),
  // Older clients and pre-cadence backups omit it; those rows are monthly.
  cadence: z.enum(MOVEMENT_CADENCES).default("monthly"),
  note: z.string().max(2000).default("")
});

export const snapshotSchema = z.object({
  snapshotDate: moneyIsoDate,
  lowRisk: z.coerce.number().default(0),
  mediumRisk: z.coerce.number().default(0),
  highRisk: z.coerce.number().default(0),
  liquid: z.coerce.number().default(0)
});

export const stylesSchema = z.object({
  styles: z
    .record(
      z.string().min(1).max(120),
      z.object({
        colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
        riskLevel: z.enum(["low", "medium", "high"]).optional().nullable()
      })
    )
    .refine((v) => Object.keys(v).length <= 500, "Too many style entries (max 500)")
});

export const moneyPrefsSchema = z.object({ showZeroAssets: z.boolean() });

// Import rows stay loosely typed on purpose: the fields are read defensively
// by applyImport, and passthrough keeps unknown keys so a backup written by
// an older or newer version still imports.
const looseRow = z.looseObject({});

export const moneyBackupImportSchema = z.object({
  transactions: z.array(looseRow).max(50_000).optional(),
  monthlyMovements: z.array(looseRow).max(50_000).optional(),
  monthlySnapshots: z.array(looseRow).max(50_000).optional(),
  // Same constraints as stylesSchema above: these land in the same columns and
  // the colour is rendered as a CSS value, so the JSON import cannot be looser
  // than the endpoint that writes them directly.
  assetColors: z.record(z.string().min(1).max(120), z.string().regex(/^#[0-9a-fA-F]{6}$/)).optional(),
  assetRisks: z.record(z.string().min(1).max(120), z.enum(["low", "medium", "high"])).optional(),
  preferences: looseRow.optional()
});
