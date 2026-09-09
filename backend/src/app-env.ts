import type { DrizzleDB } from "./db/index.ts";
import type { SQLiteDB } from "./db.ts";

/**
 * Context variables every API route can read: db/rawDb are set by app.ts for
 * all of /api, the user fields by requireAuth.
 */
export type AppEnv = {
  Variables: { db: DrizzleDB; rawDb: SQLiteDB; userId: number; userEmail: string; sessionSid: string };
};
