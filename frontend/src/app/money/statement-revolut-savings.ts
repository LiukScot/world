/** The Revolut Bank savings statement: `Deposito senza vincoli`. */

import {
  amounts,
  assertAccountsFor,
  byMonth,
  DEPOSIT_ASSET,
  isoDate,
  IT_AMOUNT,
  IT_MONTHS,
  round2,
  statedTotal,
  StatementError,
  TOLERANCE,
  unclassified,
  x,
  y,
  type ImportRow,
  type Pages,
  type ParsedStatement,
  type TextFragment,
} from "./statement-core";

const SAVINGS_PERIOD = /Periodo: ?(\d{1,2} [a-z]{3} \d{4}) - (\d{1,2} [a-z]{3} \d{4})/;
const SAVINGS_DAY = /^(\d{1,2}) ([a-z]{3})$/;

// ── Revolut Bank: the savings account ────────────────────────────────────

/**
 * Where the transaction table's columns sit, in PDF points from the left edge.
 * The table is not made of lines: one transaction spans three baselines, with
 * its day and year stacked in the left column and its balance split from its
 * euro sign. What identifies a value is the column it sits in.
 */
const SAVINGS_COLUMNS = { date: 80, descriptionFrom: 85, descriptionTo: 300, amountFrom: 400, balanceFrom: 505 };
/** How far down from its day one transaction reaches. Rows sit 33 points apart. */
const SAVINGS_ROW_HEIGHT = 15;

type SavingsRow = { txDate: string; description: string; stated: number; balance: number };

/** Reads the transaction table of one page, topmost transaction first. */
function savingsRowsOfPage(page: TextFragment[]): SavingsRow[] {
  const days = page
    .filter((item) => x(item) < SAVINGS_COLUMNS.date && SAVINGS_DAY.test(item.str))
    .sort((a, b) => y(b) - y(a));

  return days.map((start) => {
    const top = y(start);
    const band = page.filter((item) => y(item) > top - SAVINGS_ROW_HEIGHT && y(item) <= top + 2);
    const column = (from: number, to: number) =>
      band
        .filter((item) => x(item) >= from && x(item) < to)
        .sort((a, b) => y(b) - y(a) || x(a) - x(b))
        .map((item) => item.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

    const year = band.find((item) => x(item) < SAVINGS_COLUMNS.date && /^\d{4}$/.test(item.str));
    if (!year) throw new StatementError(`Transaction dated "${start.str}" states no year`);
    const day = SAVINGS_DAY.exec(start.str) as RegExpExecArray;

    // A wide enough figure is written as a number on one baseline and its euro
    // sign on the next, in both money columns, so the gap has to go before the
    // two halves read as one amount.
    const money = (from: number, to: number) => amounts(column(from, to).replace(/ /g, ""), IT_AMOUNT);
    const moved = money(SAVINGS_COLUMNS.amountFrom, SAVINGS_COLUMNS.balanceFrom);
    const balance = money(SAVINGS_COLUMNS.balanceFrom, Infinity);
    if (moved.length !== 1 || balance.length !== 1) {
      throw new StatementError(`Transaction of ${start.str} ${year.str} states no single amount and balance`);
    }
    return {
      txDate: isoDate(day[1], day[2], year.str, IT_MONTHS),
      description: column(SAVINGS_COLUMNS.descriptionFrom, SAVINGS_COLUMNS.descriptionTo),
      stated: moved[0],
      balance: balance[0],
    };
  });
}

export function parseSavings(pages: Pages, lines: string[]): ParsedStatement {
  const period = lines.find((line) => SAVINGS_PERIOD.test(line))?.match(SAVINGS_PERIOD);
  if (!period) throw new StatementError("No reporting period in this statement");
  const toIso = (text: string) => {
    const [day, month, year] = text.split(" ");
    return isoDate(day, month, year, IT_MONTHS);
  };

  const opening = statedTotal(lines, "Saldo iniziale");
  const closing = statedTotal(lines, "Saldo finale");
  const statedIn = statedTotal(lines, "Totale depositato");
  const statedOut = statedTotal(lines, "Totale prelevato");
  const statedInterest = statedTotal(lines, "Interessi totali pagati (netti)");

  const rows: ImportRow[] = [];
  let balance = opening;
  let paidIn = 0;
  let takenOut = 0;
  let interest = 0;

  for (const page of pages) {
    for (const row of savingsRowsOfPage(page)) {
      // The euro columns say how much moved but not which way. The running
      // balance says both, and the stated amount then confirms it.
      const signed = round2(row.balance - balance);
      if (Math.abs(Math.abs(signed) - row.stated) > TOLERANCE) {
        throw new StatementError(`Transaction of ${row.txDate} moves €${Math.abs(signed)} but states €${row.stated}`);
      }
      balance = row.balance;

      if (row.description.startsWith("Interessi netti pagati")) {
        interest += signed;
        rows.push({ txDate: row.txDate, asset: DEPOSIT_ASSET, tipo: "interessi", buyValue: 0, pnl: signed, note: "" });
      } else if (row.description.startsWith("Deposito sul conto") || row.description.startsWith("Prelievo dal conto")) {
        if (signed >= 0) paidIn += signed;
        else takenOut -= signed;
        rows.push({ txDate: row.txDate, asset: DEPOSIT_ASSET, tipo: "nuovo vincolo", buyValue: signed, pnl: 0, note: "" });
      } else {
        throw unclassified(row.description);
      }
    }
  }

  if (rows.length === 0) throw new StatementError("No transactions in this statement");
  // Four figures the statement states about itself, each checked against the
  // rows. Together they catch a value read from the wrong column, and a row
  // that never became a transaction.
  for (const [computed, stated, what] of [
    [balance, closing, "the closing balance"],
    [round2(paidIn), statedIn, "the total paid in"],
    [round2(takenOut), statedOut, "the total taken out"],
    [round2(interest), statedInterest, "the interest paid"],
  ] as const) {
    if (Math.abs(computed - stated) > TOLERANCE) {
      throw new StatementError(`The rows give €${round2(computed)} for ${what}, but the statement states €${stated}`);
    }
  }

  const monthly = byMonth(rows);
  assertAccountsFor(monthly, closing - opening, "the account");

  return {
    source: "revolut-savings",
    periodFrom: toIso(period[1]),
    periodTo: toIso(period[2]),
    assets: [DEPOSIT_ASSET],
    rows: monthly,
    skipped: [],
    openingBalance: opening,
  };
}
