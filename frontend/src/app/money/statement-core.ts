/**
 * What every bank statement parser shares: the shape of a page, the money and
 * date formats, and the checks a parser runs before it hands rows over.
 *
 * Pure on purpose. `pdf-text.ts` owns the pdfjs dependency, everything here and
 * in the `statement-*` files is exercised by tests with plain data.
 *
 * Amounts are rounded to cents on the way out. Every parser refuses a statement
 * whose figures do not add up rather than importing wrong numbers, so a layout
 * change on the bank's side surfaces as an error instead of a corrupt ledger.
 */

/** The shape of a text fragment, as a PDF page reports it. */
export type TextFragment = { str: string; transform: number[] };

/** One page's fragments, pages in document order. */
export type Pages = TextFragment[][];

export function x(item: TextFragment): number {
  return item.transform[4];
}

export function y(item: TextFragment): number {
  return item.transform[5];
}

/**
 * Rebuilds visual lines from the fragments a page is made of. Fragments sharing
 * a baseline belong to the same line; sorted by horizontal position and joined,
 * they reproduce what the reader sees. The half-point rounding absorbs the
 * sub-pixel drift between fragments of one line.
 */
export function linesFromFragments(items: TextFragment[]): string[] {
  const rows = new Map<number, TextFragment[]>();
  for (const item of items) {
    if (item.str === "") continue;
    const baseline = Math.round(y(item) * 2) / 2;
    const row = rows.get(baseline);
    if (row) row.push(item);
    else rows.set(baseline, [item]);
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, row]) =>
      row
        .sort((a, b) => x(a) - x(b))
        .map((item) => item.str)
        .join("")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((line) => line !== "");
}

/** Asset names already in use. Changing one splits a holding in two on the dashboard. */
export const ROBO_ASSET = "revolut robo-advisor";
export const DEPOSIT_ASSET = "revolut";
export const CHERRY_ASSET = "cherrybank";

/** Cents of slack when comparing a stated total with a computed one. */
export const TOLERANCE = 0.011;

export type ImportRow = {
  txDate: string;
  asset: string;
  tipo: string;
  buyValue: number;
  pnl: number;
  note: string;
};

export type SkippedGroup = { reason: string; count: number };

export type ParsedStatement = {
  source: "revolut-robo" | "revolut-savings" | "cherrybank";
  periodFrom: string;
  periodTo: string;
  assets: string[];
  rows: ImportRow[];
  skipped: SkippedGroup[];
  /**
   * What the account was already worth when the period opened. A statement
   * covers its period and nothing before it, so this money appears in no row:
   * unless the ledger already holds the earlier history, the import falls short
   * of the account by exactly this much.
   */
  openingBalance: number;
};

/** A statement that cannot be read, or whose own totals contradict its rows. */
export class StatementError extends Error {}

export const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const IT_MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

// "€1,992.59", "-€0.30", "US$0". The sign sits outside the currency symbol.
export const EN_AMOUNT = /(-?)(?:US\$|\$|€)(\d[\d,]*(?:\.\d+)?)/g;
// "25.798,46€", and "senza0,10€" where the column gap collapsed to nothing.
export const IT_AMOUNT = /(-?)(\d[\d.]*(?:,\d+)?)€/g;

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isoDate(day: string, month: string, year: string, months: string[]): string {
  const index = months.indexOf(month);
  if (index < 0) throw new StatementError(`Unknown month "${month}"`);
  return `${year}-${String(index + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function amounts(text: string, pattern: RegExp): number[] {
  pattern.lastIndex = 0;
  const found: number[] = [];
  for (const match of text.matchAll(pattern)) {
    const digits = pattern === EN_AMOUNT
      ? match[2].replace(/,/g, "")
      : match[2].replace(/\./g, "").replace(",", ".");
    const value = Number(digits);
    if (!Number.isFinite(value)) throw new StatementError(`Unreadable amount "${match[0]}"`);
    found.push(match[1] === "-" ? -value : value);
  }
  return found;
}

/** The single figure a summary line states, e.g. "Saldo finale 25.798,46€". */
export function statedTotal(lines: string[], label: string): number {
  const line = lines.find((candidate) => candidate.startsWith(label));
  if (!line) throw new StatementError(`The statement does not state "${label}"`);
  const found = amounts(line, IT_AMOUNT);
  if (found.length !== 1) throw new StatementError(`"${label}" does not state a single amount`);
  return found[0];
}

/**
 * A row that moves money we cannot classify would be absorbed into whatever
 * figure the parser derives by subtraction, leaving a total that still adds up
 * and a ledger that no longer says where the money went.
 */
export function unclassified(text: string): StatementError {
  return new StatementError(`Unrecognised transaction: "${text.slice(0, 70)}"`);
}

/**
 * The rows about to be written must account for the whole move the statement
 * reports over its period. Every unreadable input is already refused further
 * up, so what this guards is the grouping below it: if aggregation ever drops
 * or mis-sums a row, the import stops instead of writing a short ledger.
 */
export function assertAccountsFor(rows: ImportRow[], expected: number, what: string): void {
  const moved = round2(rows.reduce((sum, row) => sum + row.buyValue + row.pnl, 0));
  if (Math.abs(moved - round2(expected)) > TOLERANCE) {
    throw new StatementError(`The imported rows move €${moved}, but ${what} changed by €${round2(expected)}`);
  }
}

/**
 * One row per asset, tipo and calendar month, dated on the last day that month
 * contributed. Matches how these rows have always been entered by hand, and
 * keeps a year of daily interest from becoming 365 lines.
 */
export function byMonth(rows: ImportRow[]): ImportRow[] {
  const groups = new Map<string, ImportRow>();
  for (const row of rows) {
    const key = `${row.asset}|${row.tipo}|${row.txDate.slice(0, 7)}`;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, { ...row });
      continue;
    }
    current.buyValue += row.buyValue;
    current.pnl += row.pnl;
    if (row.txDate > current.txDate) current.txDate = row.txDate;
  }
  return [...groups.values()]
    .map((row) => ({ ...row, buyValue: round2(row.buyValue), pnl: round2(row.pnl) }))
    .filter((row) => row.buyValue !== 0 || row.pnl !== 0)
    .sort((a, b) => a.txDate.localeCompare(b.txDate) || a.tipo.localeCompare(b.tipo));
}

export const SKIP_NO_AMOUNT = "rows with no amount";
export const SKIP_NON_EURO = "rows in another currency";

export function countSkip(counts: Map<string, number>, reason: string): void {
  counts.set(reason, (counts.get(reason) ?? 0) + 1);
}

export function skippedList(counts: Map<string, number>): SkippedGroup[] {
  return [...counts.entries()].map(([reason, count]) => ({ reason, count }));
}
