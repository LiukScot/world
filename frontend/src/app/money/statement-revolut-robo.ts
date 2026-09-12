/**
 * The Revolut Securities account statement: the robo-advisor portfolio.
 *
 * This statement states no totals for what was paid in, earned or charged, so
 * the market revaluation can only be what the classified rows leave unexplained.
 * That makes it a plug: anything the loop below drops silently becomes a
 * market gain. Every line in the transaction table therefore has to be either
 * classified or refused, never skipped for being unreadable.
 */

import {
  amounts,
  assertAccountsFor,
  byMonth,
  countSkip,
  EN_AMOUNT,
  EN_MONTHS,
  isoDate,
  round2,
  ROBO_ASSET,
  skippedList,
  SKIP_NON_EURO,
  StatementError,
  TOLERANCE,
  unclassified,
  type ImportRow,
  type ParsedStatement,
} from "./statement-core";

const ROBO_TX_LINE = /^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4}) \d{2}:\d{2}:\d{2}/;
const ROBO_PERIOD = /Period ?(\d{1,2} [A-Z][a-z]{2} \d{4}) - (\d{1,2} [A-Z][a-z]{2} \d{4})/;
const SKIP_TRADES = "ETF trades (the robo reinvesting money already counted at top-up)";

// ── Revolut Securities: the robo portfolio ───────────────────────────────

/**
 * `Total` inside the EUR account summary, which is the only place carrying both
 * the opening and the closing value. The portfolio breakdown further down
 * repeats `Total` with the closing figure alone.
 */
function euroSummaryTotals(lines: string[]): { start: number; end: number } {
  const from = lines.findIndex((line) => line.startsWith("EUR Account summary"));
  if (from < 0) throw new StatementError("No EUR account summary in this statement");
  const until = lines.findIndex((line, i) => i > from && line.startsWith("EUR Portfolio breakdown"));
  const block = lines.slice(from, until < 0 ? lines.length : until);

  const totals = block.find((line) => line.startsWith("Total ") && amounts(line, EN_AMOUNT).length === 2);
  if (!totals) throw new StatementError("No opening and closing total in the EUR account summary");
  const [start, end] = amounts(totals, EN_AMOUNT);

  const parts = amounts(block.find((line) => line.startsWith("Positions Value")) ?? "", EN_AMOUNT);
  const cash = amounts(block.find((line) => line.startsWith("Cash value")) ?? "", EN_AMOUNT);
  if (parts.length !== 2 || cash.length !== 2) {
    throw new StatementError("The EUR account summary does not state both positions and cash");
  }
  const closing = round2(parts[1] + cash[1]);
  if (Math.abs(closing - end) > TOLERANCE) {
    throw new StatementError(`Positions and cash add up to €${closing}, but the statement totals €${end}`);
  }
  return { start, end };
}

export function parseRobo(lines: string[]): ParsedStatement {
  const period = lines.find((line) => ROBO_PERIOD.test(line))?.match(ROBO_PERIOD);
  if (!period) throw new StatementError("No reporting period in this statement");
  const toIso = (text: string) => {
    const [day, month, year] = text.split(" ");
    return isoDate(day, month, year, EN_MONTHS);
  };

  const { start, end } = euroSummaryTotals(lines);
  const from = lines.findIndex((line) => line.startsWith("EUR Transactions"));
  if (from < 0) throw new StatementError("No EUR transactions in this statement");

  const rows: ImportRow[] = [];
  const skipped = new Map<string, number>();
  let topUps = 0;
  let dividends = 0;
  let fees = 0;

  for (const line of lines.slice(from + 1)) {
    const date = line.match(ROBO_TX_LINE);
    if (!date) continue;
    const txDate = isoDate(date[1], date[2], date[3], EN_MONTHS);
    const value = amounts(line, EN_AMOUNT)[0];

    // The statement repeats its transaction table once per currency it holds.
    // Only the euro one belongs in a ledger kept in euro.
    if (line.includes("$")) {
      countSkip(skipped, SKIP_NON_EURO);
      continue;
    }
    if (line.includes("Trade - Market")) {
      countSkip(skipped, SKIP_TRADES);
      continue;
    }
    // Not skipped: the revaluation below is what the other rows do not
    // explain, so a transaction read without its amount would be quietly
    // rebadged as a market gain instead of the top-up or fee it is.
    if (value === undefined) throw unclassified(line);
    if (line.includes("Cash top-up")) {
      topUps += value;
      rows.push({ txDate, asset: ROBO_ASSET, tipo: "nuovo vincolo", buyValue: value, pnl: 0, note: "" });
    } else if (line.includes("Dividend")) {
      dividends += value;
      rows.push({ txDate, asset: ROBO_ASSET, tipo: "cedola", buyValue: 0, pnl: value, note: "" });
    } else if (line.includes("Robo management fee")) {
      fees += value;
      rows.push({ txDate, asset: ROBO_ASSET, tipo: "commissione", buyValue: 0, pnl: value, note: "" });
    } else {
      throw unclassified(line);
    }
  }

  const periodTo = toIso(period[2]);
  // Everything the portfolio gained or lost on the market: the change in value
  // that the cash paid in, the dividends received and the fees charged do not
  // already explain.
  rows.push({
    txDate: periodTo,
    asset: ROBO_ASSET,
    tipo: "Variazione Valore",
    buyValue: 0,
    pnl: round2(end - start - topUps - dividends - fees),
    note: "",
  });

  const monthly = byMonth(rows);
  assertAccountsFor(monthly, end - start, "the portfolio");

  return {
    source: "revolut-robo",
    periodFrom: toIso(period[1]),
    periodTo,
    assets: [ROBO_ASSET],
    rows: monthly,
    skipped: skippedList(skipped),
    openingBalance: start,
  };
}
