import { Hono } from "hono";
import type { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { transactions } from "../db/index.ts";
import { parseJson } from "../helpers.ts";
import { txSchema } from "../schemas.ts";
import { requireAuth } from "../middleware/auth.ts";
import { inferType, makeId, normalizeTx, readPageBounds } from "../money-helpers.ts";
import type { AppEnv as Env } from "../app-env.ts";

const moneyTransactions = new Hono<Env>();

moneyTransactions.use(requireAuth);

// `derivedType` and `currentValue` are client-optional: the client may send
// what it already computed, otherwise they follow from tipo/buyValue/pnl.
function deriveFields(body: z.infer<typeof txSchema>) {
  return {
    derivedType: body.derivedType || inferType(body.tipo, body.buyValue, body.pnl),
    currentValue: Number.isFinite(body.currentValue) ? Number(body.currentValue) : body.buyValue + body.pnl,
  };
}

moneyTransactions.get("/", (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const { limit, offset } = readPageBounds(c);
  const rows = db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.txDate), desc(transactions.id))
    .limit(limit)
    .offset(offset)
    .all();
  return c.json({ data: rows.map(normalizeTx) });
});

moneyTransactions.post("/", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await parseJson(c, txSchema);
  const id = makeId("tx");
  const { derivedType, currentValue } = deriveFields(body);
  db.insert(transactions)
    .values({
      id,
      userId,
      txDate: body.txDate,
      asset: body.asset,
      tipo: body.tipo,
      derivedType,
      buyValue: body.buyValue,
      pnl: body.pnl,
      currentValue,
      note: body.note,
    })
    .run();
  return c.json({ data: { id } }, 201);
});

moneyTransactions.put("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await parseJson(c, txSchema);
  const { derivedType, currentValue } = deriveFields(body);
  const updated = db
    .update(transactions)
    .set({
      txDate: body.txDate,
      asset: body.asset,
      tipo: body.tipo,
      derivedType,
      buyValue: body.buyValue,
      pnl: body.pnl,
      currentValue,
      note: body.note,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning({ id: transactions.id })
    .all();
  if (updated.length === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: "Transaction not found" } }, 404);
  }
  return c.json({ data: { ok: true } });
});

moneyTransactions.delete("/:id", (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const deleted = db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning({ id: transactions.id })
    .all();
  if (deleted.length === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: "Transaction not found" } }, 404);
  }
  return c.json({ data: { ok: true } });
});

export default moneyTransactions;
