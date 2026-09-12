import type { Context } from "hono";

/**
 * Row shapers and id/type derivation for the Money realm, ported from the
 * standalone money app. Kept out of helpers.ts so the shared module does not
 * grow a second realm's vocabulary.
 */

export function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function inferType(tipo: string, buyValue: number, pnl: number): string {
  if (tipo === "nuovo vincolo") return buyValue >= 0 ? "buy" : "sell";
  if (tipo === "commissione") return "fee";
  if (tipo === "cedola" || tipo === "interessi" || tipo === "cashback") return pnl >= 0 ? "return" : "fee";
  if (tipo === "Variazione Valore") return pnl >= 0 ? "value-up" : "value-down";
  if (buyValue >= 0 && pnl >= 0) return "buy";
  if (buyValue >= 0 && pnl < 0) return "buy-loss";
  if (buyValue < 0 && pnl >= 0) return "sell";
  return "sell-loss";
}

/**
 * Server-side hard cap for the list endpoints. Even with no `?limit`, we
 * never return more than DEFAULT_LIMIT rows — a decade of monthly records
 * stays far below it, so hitting the cap means something pathological.
 */
export const DEFAULT_LIMIT = 1000;
export const MAX_LIMIT = 5000;

export function readPageBounds(c: Context): { limit: number; offset: number } {
  return {
    limit: clampInt(c.req.query("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT),
    offset: clampInt(c.req.query("offset"), 0, 0, Number.MAX_SAFE_INTEGER),
  };
}

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw == null) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

type TxRow = {
  id: string;
  txDate: string;
  asset: string;
  tipo: string;
  derivedType: string;
  buyValue: number;
  pnl: number;
  currentValue: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type MovementRow = {
  id: string;
  name: string;
  direction: string;
  amount: number;
  cadence: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type SnapshotRow = {
  id: string;
  snapshotDate: string;
  lowRisk: number;
  mediumRisk: number;
  highRisk: number;
  liquid: number;
  createdAt: string;
  updatedAt: string;
};

export function normalizeTx(row: TxRow) {
  return {
    id: row.id,
    txDate: row.txDate,
    asset: row.asset,
    tipo: row.tipo,
    derivedType: row.derivedType,
    buyValue: Number(row.buyValue),
    pnl: Number(row.pnl),
    currentValue: Number(row.currentValue),
    note: row.note ?? "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function normalizeMovement(row: MovementRow) {
  return {
    id: row.id,
    name: row.name,
    direction: row.direction,
    amount: Number(row.amount),
    cadence: row.cadence,
    note: row.note ?? "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function normalizeSnapshot(row: SnapshotRow) {
  return {
    id: row.id,
    snapshotDate: row.snapshotDate,
    lowRisk: Number(row.lowRisk),
    mediumRisk: Number(row.mediumRisk),
    highRisk: Number(row.highRisk),
    liquid: Number(row.liquid),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
