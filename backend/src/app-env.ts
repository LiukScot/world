import type { DrizzleDB } from "./db/index.ts";
import type { SQLiteDB } from "./db.ts";

/** Context variables every API route can read, set by the host (local-app.ts). */
export type AppEnv = {
  Variables: { db: DrizzleDB; rawDb: SQLiteDB; userId: number };
};
