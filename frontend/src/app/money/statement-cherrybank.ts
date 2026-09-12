/**
 * The Cherry Bank account statement. The asset is the whole account: the
 * current account and the time deposits it feeds. What it is worth is
 * therefore what was paid into it from outside plus what it earned, which is
 * what the statement's own movements add up to.
 */

import {
  byMonth,
  CHERRY_ASSET,
  countSkip,
  round2,
  skippedList,
  StatementError,
  TOLERANCE,
  x,
  y,
  type ImportRow,
  type Pages,
  type ParsedStatement,
  type TextFragment,
} from "./statement-core";

const CHERRY_DAY = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const CHERRY_BALANCE = /(\d{2})\/(\d{2})\/(\d{4})\s+([+-]?\d[\d.]*,\d\d)\s*Euro/;

// ── Cherry Bank: time deposits, seen from the current account ────────────

/**
 * Columns of the movement table, in PDF points. `Dare` and `Avere` are two
 * columns but one figure: the debit column already carries its minus sign, so
 * the pair reads as a single signed amount.
 */
const CHERRY_COLUMNS = { valutaFrom: 90, valutaTo: 160, amountFrom: 180, amountTo: 300, descriptionFrom: 300 };

/**
 * Subscriptions and repayments move money between the current account and the
 * deposits, and both sides are this same asset, so they cancel out. Booking
 * them would count the deposits on top of the money that paid for them.
 */
const CHERRY_INTERNAL = ["SOTTOSCRIZIONE TIME DEPOSIT", "RIMBORSO PARTITA TIME DEPOSIT"];

/** Interest earned by the deposits, credited to the current account. */
const CHERRY_INTEREST = "COMPETENZE TIME DEPOSIT";

/**
 * What the bank charges, as the statement spells it. Each has to be a phrase
 * no other row can contain: a SEPA transfer carries its own fee fields in its
 * description ("IMP SPESE 0,00", "IMP COMM 0,00"), so a bare "SPESE" or
 * "COMM" matches every transfer ever received.
 */
const CHERRY_COSTS = ["IMPOSTA BOLLO", "RITENUTA", "INTERESSI DEBITORI"];

const SKIP_INTERNAL = "moves between the current account and its deposits, which are both this asset";

/**
 * The date and amount a `Saldo Contabile ...` line states, e.g.
 * "Saldo Contabile Finale 11/09/2026 +0,00 Euro". The date is the statement's
 * own period edge, which is what an import replacing a period has to cover:
 * taking it from the rows instead would leave behind anything the statement
 * holds outside them.
 */
function cherryBalance(lines: string[], label: string): { date: string; value: number } {
  const line = lines.find((candidate) => candidate.includes(label));
  const stated = line?.match(CHERRY_BALANCE);
  if (!stated) throw new StatementError(`The statement does not state "${label}"`);
  const value = Number(stated[4].replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(value)) throw new StatementError(`Unreadable balance "${stated[4]}"`);
  return { date: `${stated[3]}-${stated[2]}-${stated[1]}`, value };
}

type CherryRow = { txDate: string; description: string; amount: number };

/**
 * Reads the movement table of one page. A movement is one line of dates and
 * one figure, with its description wrapped across the lines above and below it,
 * so each row reaches halfway to its neighbours.
 */
function cherryRowsOfPage(page: TextFragment[]): CherryRow[] {
  const dates = page
    .filter((item) => x(item) < CHERRY_COLUMNS.valutaFrom && CHERRY_DAY.test(item.str.trim()))
    .sort((a, b) => y(b) - y(a));

  return dates.flatMap((start, index) => {
    const top = y(start);
    const above = index === 0 ? Infinity : (y(dates[index - 1]) + top) / 2;
    const below = index === dates.length - 1 ? -Infinity : (y(dates[index + 1]) + top) / 2;
    const band = page.filter((item) => y(item) > below && y(item) < above);
    const column = (from: number, to: number) =>
      band.filter((item) => x(item) >= from && x(item) < to).sort((a, b) => y(b) - y(a) || x(a) - x(b));

    const money = column(CHERRY_COLUMNS.amountFrom, CHERRY_COLUMNS.amountTo).filter((item) =>
      /^-?\d[\d.]*,\d\d$/.test(item.str.trim()),
    );
    // The header and the balance lines carry dates but no movement.
    if (money.length !== 1) return [];

    // The value date, not the accounting one: it is the day the money starts
    // counting, which for a deposit is the day the term begins.
    const valuta = column(CHERRY_COLUMNS.valutaFrom, CHERRY_COLUMNS.valutaTo).find((item) =>
      CHERRY_DAY.test(item.str.trim()),
    );
    const day = CHERRY_DAY.exec((valuta ?? start).str.trim()) as RegExpExecArray;

    return [{
      txDate: `${day[3]}-${day[2]}-${day[1]}`,
      description: column(CHERRY_COLUMNS.descriptionFrom, Infinity).map((item) => item.str).join(" ").replace(/\s+/g, " ").trim(),
      amount: Number(money[0].str.trim().replace(/\./g, "").replace(",", ".")),
    }];
  });
}

export function parseCherry(pages: Pages, lines: string[]): ParsedStatement {
  const opening = cherryBalance(lines, "Saldo Contabile Iniziale");
  const closing = cherryBalance(lines, "Saldo Contabile Finale");

  const rows: ImportRow[] = [];
  const skipped = new Map<string, number>();
  let everything = 0;

  for (const page of pages) {
    for (const row of cherryRowsOfPage(page)) {
      everything += row.amount;
      if (CHERRY_INTERNAL.some((match) => row.description.toUpperCase().includes(match))) {
        countSkip(skipped, SKIP_INTERNAL);
        continue;
      }
      // Everything else is read with the sign the statement prints, because
      // the account's own view is the asset's view: money arriving is capital
      // put in, money leaving is capital taken out, interest is what the
      // deposits earned and stamp duty what holding them cost. A charge only
      // ever takes money out, so a credit is capital whatever its wording.
      const description = row.description.toUpperCase();
      const tipo = description.includes(CHERRY_INTEREST)
        ? "cedola"
        : row.amount < 0 && CHERRY_COSTS.some((match) => description.includes(match))
          ? "commissione"
          : "nuovo vincolo";
      rows.push({
        txDate: row.txDate,
        asset: CHERRY_ASSET,
        tipo,
        buyValue: tipo === "nuovo vincolo" ? row.amount : 0,
        pnl: tipo === "nuovo vincolo" ? 0 : row.amount,
        note: "",
      });
    }
  }

  if (rows.length === 0) throw new StatementError("No Cherry Bank movements in this statement");
  // Every movement of the account, kept or skipped, has to explain the balance
  // it went from and to. It is the only figure this statement states about
  // itself, and it proves each amount was read from the right column.
  if (Math.abs(round2(everything) - round2(closing.value - opening.value)) > TOLERANCE) {
    throw new StatementError(
      `The movements add up to €${round2(everything)}, but the account went from €${opening.value} to €${closing.value}`,
    );
  }

  // A movement's value date can sit a day or two outside the accounting dates
  // the statement declares, and every row imported has to fall inside the
  // period, or replacing that period would not replace all of them.
  const dates = [opening.date, closing.date, ...rows.map((row) => row.txDate)].sort();
  return {
    source: "cherrybank",
    periodFrom: dates[0],
    periodTo: dates[dates.length - 1],
    assets: [CHERRY_ASSET],
    rows: byMonth(rows),
    skipped: skippedList(skipped),
    openingBalance: opening.value,
  };
}
