import { Hono } from "hono";
import type { z } from "zod";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { transactions } from "../db/index.ts";
import { parseJson } from "../helpers.ts";
import { txImportSchema, txSchema } from "../schemas.ts";
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

/** Identifies a row by what it records, so re-importing a statement is a no-op. */
function dedupeKey(row: { txDate: string; asset: string; tipo: string; buyValue: number; pnl: number }): string {
  return [row.txDate, row.asset, row.tipo, row.buyValue.toFixed(2), row.pnl.toFixed(2)].join("|");
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

moneyTransactions.post("/import", async (c) => {
  const db = c.get("db");
  const rawDb = c.get("rawDb");
  const userId = c.get("userId");
  const body = await parseJson(c, txImportSchema);
  const { replace } = body;
  if (replace && replace.from > replace.to) {
    return c.json({ error: { code: "INVALID_RANGE", message: "Replacement period ends before it starts" } }, 400);
  }

  // Both the replacement and the duplicate check are confined to what the
  // statement itself carries, so neither can reach a row it never mentions.
  const assets = [...new Set(body.rows.map((row) => row.asset))];
  const dates = body.rows.map((row) => row.txDate).sort();
  const scope = and(
    eq(transactions.userId, userId),
    inArray(transactions.asset, assets),
    gte(transactions.txDate, dates[0]!),
    lte(transactions.txDate, dates[dates.length - 1]!),
  );

  const apply = rawDb.transaction(() => {
    const deleted = replace
      ? db
          .delete(transactions)
          .where(
            and(
              eq(transactions.userId, userId),
              inArray(transactions.asset, assets),
              gte(transactions.txDate, replace.from),
              lte(transactions.txDate, replace.to),
            ),
          )
          .returning({ id: transactions.id })
          .all().length
      : 0;

    const existing = new Set(
      db
        .select({
          txDate: transactions.txDate,
          asset: transactions.asset,
          tipo: transactions.tipo,
          buyValue: transactions.buyValue,
          pnl: transactions.pnl,
        })
        .from(transactions)
        .where(scope)
        .all()
        .map(dedupeKey),
    );

    const fresh = body.rows.filter((row) => {
      const key = dedupeKey(row);
      if (existing.has(key)) return false;
      // Guards against a statement that repeats a row within the same file.
      existing.add(key);
      return true;
    });

    if (fresh.length > 0) {
      db.insert(transactions)
        .values(
          fresh.map((row) => ({
            id: makeId("tx"),
            userId,
            txDate: row.txDate,
            asset: row.asset,
            tipo: row.tipo,
            ...deriveFields(row),
            buyValue: row.buyValue,
            pnl: row.pnl,
            note: row.note,
          })),
        )
        .run();
    }
    return { inserted: fresh.length, skipped: body.rows.length - fresh.length, deleted };
  });

  return c.json({ data: apply() });
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
