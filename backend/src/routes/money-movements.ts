import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import { monthlyMovements } from "../db/index.ts";
import { parseJson } from "../helpers.ts";
import { movementSchema } from "../schemas.ts";
import { requireAuth } from "../middleware/auth.ts";
import { makeId, normalizeMovement, readPageBounds } from "../money-helpers.ts";
import type { AppEnv as Env } from "../app-env.ts";

const moneyMovements = new Hono<Env>();

moneyMovements.use(requireAuth);

moneyMovements.get("/", (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const { limit, offset } = readPageBounds(c);
  const rows = db
    .select()
    .from(monthlyMovements)
    .where(eq(monthlyMovements.userId, userId))
    .orderBy(desc(monthlyMovements.amount), monthlyMovements.name, desc(monthlyMovements.id))
    .limit(limit)
    .offset(offset)
    .all();
  return c.json({ data: rows.map(normalizeMovement) });
});

moneyMovements.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await parseJson(c, movementSchema);
  const id = makeId("mm");
  db.insert(monthlyMovements)
    .values({
      id,
      userId,
      name: body.name,
      direction: body.direction,
      amount: body.amount,
      cadence: body.cadence,
      note: body.note,
    })
    .run();
  return c.json({ data: { id } }, 201);
});

moneyMovements.put("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await parseJson(c, movementSchema);
  const updated = db
    .update(monthlyMovements)
    .set({
      name: body.name,
      direction: body.direction,
      amount: body.amount,
      cadence: body.cadence,
      note: body.note,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(and(eq(monthlyMovements.id, id), eq(monthlyMovements.userId, userId)))
    .returning({ id: monthlyMovements.id })
    .all();
  if (updated.length === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: "Monthly movement not found" } }, 404);
  }
  return c.json({ data: { ok: true } });
});

moneyMovements.delete("/:id", (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const deleted = db
    .delete(monthlyMovements)
    .where(and(eq(monthlyMovements.id, id), eq(monthlyMovements.userId, userId)))
    .returning({ id: monthlyMovements.id })
    .all();
  if (deleted.length === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: "Monthly movement not found" } }, 404);
  }
  return c.json({ data: { ok: true } });
});

export default moneyMovements;
