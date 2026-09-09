import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { userPreferences } from "../db/index.ts";
import { parseJson } from "../helpers.ts";
import { moneyPrefsSchema } from "../schemas.ts";
import { requireAuth } from "../middleware/auth.ts";
import type { AppEnv as Env } from "../app-env.ts";

// Money's slice of user_preferences. Both realms write the same row, each
// touching only its own columns, so the upserts below never clobber the
// health preferences and vice versa.
const moneyPrefs = new Hono<Env>();

moneyPrefs.use(requireAuth);

moneyPrefs.get("/", (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const row = db
    .select({ showZeroAssets: userPreferences.showZeroAssets, updatedAt: userPreferences.updatedAt })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1)
    .get();
  return c.json({
    data: {
      showZeroAssets: Boolean(row?.showZeroAssets ?? 0),
      updatedAt: row?.updatedAt ?? null,
    },
  });
});

moneyPrefs.put("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await parseJson(c, moneyPrefsSchema);
  const showZeroAssets = body.showZeroAssets ? 1 : 0;
  db.insert(userPreferences)
    .values({ userId, showZeroAssets })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { showZeroAssets: sql`excluded.show_zero_assets`, updatedAt: sql`CURRENT_TIMESTAMP` },
    })
    .run();
  return c.json({ data: { ok: true } });
});

export default moneyPrefs;
