import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import { monthlySnapshots } from "../db/index.ts";
import { parseJson } from "../helpers.ts";
import { snapshotSchema } from "../schemas.ts";
import { requireAuth } from "../middleware/auth.ts";
import { makeId, normalizeSnapshot, readPageBounds } from "../money-helpers.ts";
import type { AppEnv as Env } from "../app-env.ts";

const moneySnapshots = new Hono<Env>();

moneySnapshots.use(requireAuth);

moneySnapshots.get("/", (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const { limit, offset } = readPageBounds(c);
  const rows = db
    .select()
    .from(monthlySnapshots)
    .where(eq(monthlySnapshots.userId, userId))
    .orderBy(desc(monthlySnapshots.snapshotDate), desc(monthlySnapshots.id))
    .limit(limit)
    .offset(offset)
    .all();
  return c.json({ data: rows.map(normalizeSnapshot) });
});

moneySnapshots.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await parseJson(c, snapshotSchema);
  const id = makeId("snap");
  db.insert(monthlySnapshots)
    .values({
      id,
      userId,
      snapshotDate: body.snapshotDate,
      lowRisk: body.lowRisk,
      mediumRisk: body.mediumRisk,
      highRisk: body.highRisk,
      liquid: body.liquid,
    })
    .run();
  return c.json({ data: { id } }, 201);
});

moneySnapshots.put("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await parseJson(c, snapshotSchema);
  const updated = db
    .update(monthlySnapshots)
    .set({
      snapshotDate: body.snapshotDate,
      lowRisk: body.lowRisk,
      mediumRisk: body.mediumRisk,
      highRisk: body.highRisk,
      liquid: body.liquid,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(and(eq(monthlySnapshots.id, id), eq(monthlySnapshots.userId, userId)))
    .returning({ id: monthlySnapshots.id })
    .all();
  if (updated.length === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: "Monthly snapshot not found" } }, 404);
  }
  return c.json({ data: { ok: true } });
});

moneySnapshots.delete("/:id", (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const deleted = db
    .delete(monthlySnapshots)
    .where(and(eq(monthlySnapshots.id, id), eq(monthlySnapshots.userId, userId)))
    .returning({ id: monthlySnapshots.id })
    .all();
  if (deleted.length === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: "Monthly snapshot not found" } }, 404);
  }
  return c.json({ data: { ok: true } });
});

export default moneySnapshots;
