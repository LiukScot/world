import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "./drizzle-schema.ts";

export type DrizzleDB = BunSQLiteDatabase<typeof schema>;

// Re-export schema for convenience
export {
  users,
  diaryEntries,
  painEntries,
  userPreferences,
  appMeta,
  sessions,
  cbtEntries,
  dbtEntries,
  painRemovedOptions,
  painOptions,
  moodOptions,
  memorableDays,
  metricTypes,
  transactions,
  monthlyMovements,
  monthlySnapshots,
  assetStyles,
  webdavBackup
} from "./drizzle-schema.ts";
