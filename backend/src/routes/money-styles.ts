import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { assetStyles } from "../db/index.ts";
import { parseJson } from "../helpers.ts";
import { stylesSchema } from "../schemas.ts";
import { requireAuth } from "../middleware/auth.ts";
import type { AppEnv as Env } from "../app-env.ts";

const moneyStyles = new Hono<Env>();

moneyStyles.use(requireAuth);

moneyStyles.get("/", (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const rows = db
    .select({ asset: assetStyles.asset, colorHex: assetStyles.colorHex, riskLevel: assetStyles.riskLevel })
    .from(assetStyles)
    .where(eq(assetStyles.userId, userId))
    .all();
  const styles: Record<string, { colorHex: string | null; riskLevel: string | null }> = {};
  for (const row of rows) {
    styles[row.asset] = { colorHex: row.colorHex ?? null, riskLevel: row.riskLevel ?? null };
  }
  return c.json({ data: styles });
});

// The whole map is replaced in one transaction: the client always sends the
// full set, so a delete + insert is both simpler and correct for removals.
moneyStyles.put("/", async (c) => {
  const db = c.get("db");
  const rawDb = c.get("rawDb");
  const userId = c.get("userId");
  const body = await parseJson(c, stylesSchema);
  // "BTC" and "BTC " are distinct keys in the payload but the same asset once
  // trimmed, and (user_id, asset) is unique — inserting both would abort the
  // transaction. Last one wins, as it would in the object literal.
  const byAsset = new Map<string, { colorHex: string | null; riskLevel: string | null }>();
  for (const [asset, style] of Object.entries(body.styles)) {
    const key = asset.trim();
    if (!key) continue;
    byAsset.set(key, { colorHex: style.colorHex ?? null, riskLevel: style.riskLevel ?? null });
  }
  const rows = Array.from(byAsset, ([asset, style]) => ({ userId, asset, ...style }));

  const tx = rawDb.transaction(() => {
    db.delete(assetStyles).where(eq(assetStyles.userId, userId)).run();
    if (rows.length > 0) db.insert(assetStyles).values(rows).run();
  });
  tx();

  return c.json({ data: { ok: true } });
});

export default moneyStyles;
