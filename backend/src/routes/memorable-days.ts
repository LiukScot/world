import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import { memorableDays } from "../db/index.ts";
import { parseJson, parseIdParam } from "../helpers.ts";
import { memorableDaySchema } from "../schemas.ts";
import { requireAuth } from "../middleware/auth.ts";
import type { AppEnv as Env } from "../app-env.ts";

const memorableDaysRoute = new Hono<Env>();

memorableDaysRoute.use(requireAuth);

memorableDaysRoute.get("/", (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const rows = db
    .select({
      id: memorableDays.id,
      date: memorableDays.date,
      title: memorableDays.title,
      emoji: memorableDays.emoji,
      description: memorableDays.description,
      createdAt: memorableDays.createdAt,
      updatedAt: memorableDays.updatedAt,
    })
    .from(memorableDays)
    .where(eq(memorableDays.userId, userId))
    .orderBy(desc(memorableDays.date), desc(memorableDays.id))
    .all();

  return c.json({ data: rows });
});

memorableDaysRoute.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await parseJson(c, memorableDaySchema);
  const created = db
    .insert(memorableDays)
    .values({
      userId,
      date: body.date,
      title: body.title.trim(),
      emoji: body.emoji?.trim() ?? "",
      description: body.description?.trim() ?? "",
    })
    .returning({ id: memorableDays.id })
    .get();

  return c.json({ data: { id: created.id } }, 201);
});

memorableDaysRoute.put("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const parsed = parseIdParam(c);
  if (parsed instanceof Response) return parsed;
  const { id } = parsed;
  const body = await parseJson(c, memorableDaySchema);
  const updated = db
    .update(memorableDays)
    .set({
      date: body.date,
      title: body.title.trim(),
      emoji: body.emoji?.trim() ?? "",
      description: body.description?.trim() ?? "",
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(and(eq(memorableDays.id, id), eq(memorableDays.userId, userId)))
    .returning({ id: memorableDays.id })
    .get();

  if (!updated) {
    return c.json({ error: { code: "NOT_FOUND", message: "Memorable day not found" } }, 404);
  }
  return c.json({ data: { ok: true } });
});

memorableDaysRoute.delete("/:id", (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const parsed = parseIdParam(c);
  if (parsed instanceof Response) return parsed;
  const { id } = parsed;
  const deleted = db
    .delete(memorableDays)
    .where(and(eq(memorableDays.id, id), eq(memorableDays.userId, userId)))
    .returning({ id: memorableDays.id })
    .get();

  if (!deleted) {
    return c.json({ error: { code: "NOT_FOUND", message: "Memorable day not found" } }, 404);
  }
  return c.json({ data: { ok: true } });
});

export default memorableDaysRoute;
