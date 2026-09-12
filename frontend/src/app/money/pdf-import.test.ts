import { describe, expect, it } from "vitest";
import {
  CHERRY_ASSET,
  DEPOSIT_ASSET,
  linesFromFragments,
  parseStatement,
  ROBO_ASSET,
  StatementError,
  type ImportRow,
  type TextFragment,
} from "./pdf-import";

const at = (str: string, x: number, y: number): TextFragment => ({ str, transform: [1, 0, 0, 1, x, y] });

/** A page whose fragments are one per line, for a statement read as lines. */
const asPage = (lines: string[]): TextFragment[] => lines.map((str, i) => at(str, 50, 700 - i * 12));

/**
 * Amounts differ from row to row on purpose: a parser that swapped two rows,
 * dropped a sign or aggregated the wrong month produces a different total, not
 * the same one.
 */
const ROBO = [
  "Via Milite Ignoto 16Period 11 Nov 2025 - 12 Sep 2026",
  "EUR Account summary",
  "Starting Ending",
  "Positions Value €100.00 €520.00",
  "Cash value* €0 €30.00",
  "Total €100.00 €550.00",
  "EUR Portfolio breakdown",
  "SPPY Example Equity ETF IE00BH4GPZ28 20.51841405 €48.54 €520.00 94.55%",
  "Total €550.00",
  "EUR Transactions",
  "Date Symbol Type Quantity Price Side Value Fees Commission",
  "11 Nov 2025 09:39:07 GMT Cash top-up €300 €0 €0",
  "11 Nov 2025 13:00:00 GMT SPPY Trade - Market 5.93824228 €42.10 Buy €250 €0 €0",
  "20 Nov 2025 10:04:30 GMT Cash top-up €50 €0 €0",
  "11 Dec 2025 00:28:06 GMT Robo management fee -€0.30 €0 €0",
  "18 Feb 2026 11:26:44 GMT SPPY Dividend €0.16 €0 €0",
];

const SAVINGS_HEADER = [
  "Deposito senza vincoli",
  "Periodo: 1 mag 2026 - 30 giu 2026",
  "Riepilogo del saldo",
  "Saldo iniziale 100,00€",
  "Totale depositato 2.149,00€",
  "Totale prelevato 250,00€",
  "Interessi totali pagati (netti) 1,00€",
  "Saldo finale 2.000,00€",
];

const ENTRATE_X = 416;
const USCITE_X = 467;

/**
 * One transaction of the savings table. Its day and year are stacked in the
 * left column, its description wraps, and a wide figure is written as a number
 * on one baseline with its euro sign on the next: the layout this parser reads
 * columns to survive.
 */
function savingsRow(
  top: number,
  day: string,
  description: [string, string?],
  moved: { text: string | [string, string]; x: number },
  balance: [string, string],
): TextFragment[] {
  const movedFragments =
    typeof moved.text === "string"
      ? [at(moved.text, moved.x, top - 6)]
      : [at(moved.text[0], moved.x, top), at(moved.text[1], moved.x + 29, top - 12)];
  return [
    at(day, 45.3, top),
    at("2026", 45.3, top - 12),
    at(description[0], 89.4, top),
    ...(description[1] ? [at(description[1], 89.4, top - 12)] : []),
    ...movedFragments,
    at(balance[0], 515.6, top),
    at(balance[1], 544.9, top - 12),
  ];
}

const interest = (top: number, day: string, amount: string, balance: [string, string]) =>
  savingsRow(
    top,
    day,
    ['Interessi netti pagati nel conto "Conto deposito', `senza vincoli" in data ${day} 2026`],
    { text: amount, x: ENTRATE_X },
    balance,
  );

const SAVINGS_PAGE = [
  ...asPage(SAVINGS_HEADER),
  // 1.900,00 paid in, wide enough that its euro sign wraps to the next baseline.
  ...savingsRow(
    600,
    "11 mag",
    ['Deposito sul conto "Conto deposito senza vincoli"'],
    { text: ["1.900,00", "€"], x: ENTRATE_X },
    ["2.000,00", "€"],
  ),
  ...interest(567, "12 mag", "0,40€", ["2.000,40", "€"]),
  ...savingsRow(
    534,
    "13 mag",
    ['Prelievo dal conto "Conto deposito senza vincoli"'],
    { text: "250,00€", x: USCITE_X },
    ["1.750,40", "€"],
  ),
  ...interest(501, "11 giu", "0,60€", ["1.751,00", "€"]),
  ...savingsRow(
    468,
    "11 giu",
    ['Deposito sul conto "Conto deposito senza vincoli"'],
    { text: "249,00€", x: ENTRATE_X },
    ["2.000,00", "€"],
  ),
];

function find(rows: ImportRow[], tipo: string, month: string): ImportRow | undefined {
  return rows.find((row) => row.tipo === tipo && row.txDate.startsWith(month));
}

describe("robo statement", () => {
  const parsed = parseStatement([asPage(ROBO)]);

  it("reads the reporting period even when the address runs into it", () => {
    expect(parsed.source).toBe("revolut-robo");
    expect(parsed.periodFrom).toBe("2025-11-11");
    expect(parsed.periodTo).toBe("2026-09-12");
    expect(parsed.assets).toEqual([ROBO_ASSET]);
  });

  it("sums the month's top-ups and dates them on the last one", () => {
    expect(find(parsed.rows, "nuovo vincolo", "2025-11")).toMatchObject({
      txDate: "2025-11-20",
      buyValue: 350,
      pnl: 0,
    });
  });

  it("books the fee as commissione and the dividend as cedola", () => {
    expect(find(parsed.rows, "commissione", "2025-12")).toMatchObject({ pnl: -0.3, buyValue: 0 });
    expect(find(parsed.rows, "cedola", "2026-02")).toMatchObject({ pnl: 0.16, buyValue: 0 });
  });

  it("skips the ETF trades instead of counting the money twice", () => {
    expect(parsed.rows.every((row) => row.buyValue !== 250)).toBe(true);
    expect(parsed.skipped).toEqual([
      { reason: "ETF trades (the robo reinvesting money already counted at top-up)", count: 1 },
    ]);
  });

  it("never reads a dollar row as if it were euro", () => {
    const withUsd = parseStatement([asPage([...ROBO, "05 Mar 2026 09:00:00 GMT Cash top-up US$400 US$0 US$0"])]);
    expect(withUsd.rows.every((row) => row.buyValue !== 400)).toBe(true);
    expect(withUsd.skipped).toContainEqual({ reason: "rows in another currency", count: 1 });
  });

  it("derives the revaluation from what the value change does not explain", () => {
    // 550 - 100 closing minus 350 paid in, minus 0.16 of dividend, plus the 0.30 fee.
    expect(find(parsed.rows, "Variazione Valore", "2026-09")).toMatchObject({
      txDate: "2026-09-12",
      pnl: 100.14,
    });
  });

  it("leaves the ledger summing to the closing value of the portfolio", () => {
    const total = parsed.rows.reduce((sum, row) => sum + row.buyValue + row.pnl, 0);
    expect(Math.round(total * 100) / 100).toBe(450);
  });

  it("reports the opening value of the portfolio", () => {
    expect(parsed.openingBalance).toBe(100);
  });

  it("returns the rows in date order, revaluation included", () => {
    const dates = parsed.rows.map((row) => row.txDate);
    expect(dates).toEqual([...dates].sort());
  });

  it("refuses a summary whose positions and cash contradict its total", () => {
    const broken = ROBO.map((line) => (line.startsWith("Cash value*") ? "Cash value* €0 €99.00" : line));
    expect(() => parseStatement([asPage(broken)])).toThrow(StatementError);
  });

  it("refuses a summary that states one figure where it should state two", () => {
    const broken = ROBO.map((line) => (line.startsWith("Positions Value") ? "Positions Value €520.00" : line));
    expect(() => parseStatement([asPage(broken)])).toThrow(/both positions and cash/);
  });

  it("refuses a top-up whose amount it cannot read", () => {
    // The revaluation is whatever the classified rows leave unexplained, so a
    // top-up read without its amount would silently become a market gain:
    // capital booked as profit, with every total still adding up.
    const broken = [...ROBO, "09 Apr 2026 10:00:00 GMT Cash top-up EUR 120"];
    expect(() => parseStatement([asPage(broken)])).toThrow(/Unrecognised transaction/);
  });

  it("refuses a row it cannot classify instead of folding it into the revaluation", () => {
    const broken = [...ROBO, "09 Apr 2026 10:00:00 GMT Account closure payout €120 €0 €0"];
    expect(() => parseStatement([asPage(broken)])).toThrow(/Unrecognised transaction/);
  });
});

describe("savings statement", () => {
  const parsed = parseStatement([SAVINGS_PAGE]);

  it("reads the reporting period", () => {
    expect(parsed.source).toBe("revolut-savings");
    expect(parsed.assets).toEqual([DEPOSIT_ASSET]);
    expect(parsed.periodFrom).toBe("2026-05-01");
    expect(parsed.periodTo).toBe("2026-06-30");
  });

  it("takes the direction of a transfer from the running balance", () => {
    // 1900 in and 250 out in May: a parser reading the column a figure lands in
    // instead of the balance it leaves would net 2150.
    expect(find(parsed.rows, "nuovo vincolo", "2026-05")).toMatchObject({
      txDate: "2026-05-13",
      buyValue: 1650,
    });
    expect(find(parsed.rows, "nuovo vincolo", "2026-06")).toMatchObject({ buyValue: 249 });
  });

  it("sums the daily interest per month", () => {
    expect(find(parsed.rows, "interessi", "2026-05")).toMatchObject({ pnl: 0.4, buyValue: 0 });
    expect(find(parsed.rows, "interessi", "2026-06")).toMatchObject({ pnl: 0.6, buyValue: 0 });
  });

  it("leaves the ledger summing to the closing balance minus the opening one", () => {
    const total = parsed.rows.reduce((sum, row) => sum + row.buyValue + row.pnl, 0);
    expect(Math.round(total * 100) / 100).toBe(1900);
  });

  it("reports the opening balance its rows do not account for", () => {
    // 1900 of movement against a 2000 closing balance: the missing 100 is what
    // the account already held, and no row of this statement carries it.
    expect(parsed.openingBalance).toBe(100);
  });

  it("refuses when its rows contradict a total the statement states about itself", () => {
    const broken = SAVINGS_PAGE.map((item) =>
      item.str === "Totale prelevato 250,00€" ? at("Totale prelevato 400,00€", 50, item.transform[5]) : item,
    );
    expect(() => parseStatement([broken])).toThrow(/the total taken out/);
  });

  it("refuses a row whose printed amount contradicts the balance it leaves", () => {
    const broken = SAVINGS_PAGE.map((item) =>
      item.str === "250,00€" ? at("200,00€", item.transform[4], item.transform[5]) : item,
    );
    expect(() => parseStatement([broken])).toThrow(/but states/);
  });

  it("refuses a row it cannot classify", () => {
    const broken = SAVINGS_PAGE.map((item) =>
      item.str.startsWith("Prelievo dal conto")
        ? at("Ritenuta fiscale sugli interessi", item.transform[4], item.transform[5])
        : item,
    );
    expect(() => parseStatement([broken])).toThrow(/Unrecognised transaction/);
  });
});

// ── Cherry Bank ──────────────────────────────────────────────────────────

const CHERRY_X = { contabile: 33, valuta: 108, dare: 205, avere: 276, description: 307 };

/**
 * One movement of the Cherry Bank table: two dates and one figure on a line,
 * with the description wrapped above and below it. `dare` is what leaves the
 * current account, `avere` what enters it.
 */
function cherryRow(
  top: number,
  contabile: string,
  valuta: string,
  money: { amount: string; column: "dare" | "avere" },
  description: string[],
): TextFragment[] {
  return [
    at(contabile, CHERRY_X.contabile, top),
    at(valuta, CHERRY_X.valuta, top),
    at(money.amount, CHERRY_X[money.column], top),
    ...description.map((line, i) => at(line, CHERRY_X.description, top + 11 - i * 11)),
  ];
}

const CHERRY_PAGE = [
  ...asPage(["Cherry Bank S.p.A.", "Saldo Contabile Finale 15/03/2026 +50,00 Euro"]),
  // Money leaving the account to open a deposit: the deposit gains 1000.
  ...cherryRow(600, "10/01/2026", "09/01/2026", { amount: "-1.000,00", column: "dare" }, [
    "SOTTOSCRIZIONE TIME DEPOSIT N. OPER. 2026/001",
    "SCADENZA 10/07/2026",
  ]),
  ...cherryRow(550, "11/02/2026", "10/02/2026", { amount: "30,00", column: "avere" }, [
    "COMPETENZE TIME DEPOSIT INTERESSI",
  ]),
  ...cherryRow(500, "12/02/2026", "11/02/2026", { amount: "-5,00", column: "dare" }, [
    "IMPOSTA BOLLO PRODOTTI FIN.-DEP. BOLLI",
  ]),
  // Money returning to the account when a deposit matures: the deposit loses 400.
  ...cherryRow(450, "10/03/2026", "09/03/2026", { amount: "400,00", column: "avere" }, [
    "RIMBORSO PARTITA TIME DEPOSIT N. OPER. 2025/003",
    "SCADENZA 10/03/2026",
  ]),
  ...cherryRow(400, "15/03/2026", "14/03/2026", { amount: "625,00", column: "avere" }, [
    // A SEPA transfer states its own fee fields, zero here. Matching a bare
    // "SPESE" or "COMM" against a description would read this as a charge.
    "BONIFICO A VOSTRO FAVORE Data Regolamento: 14/03/26",
    "DIV SPESE EUR IMP SPESE 0,00 DIV COMM EUR IMP COMM 0,00",
  ]),
  ...asPage(["Saldo Contabile Iniziale 01/01/2026 +0,00 Euro"]).map((f) => at(f.str, 50, 100)),
];

describe("Cherry Bank statement", () => {
  const parsed = parseStatement([CHERRY_PAGE]);

  it("reads it as the time deposit account", () => {
    expect(parsed.source).toBe("cherrybank");
    expect(parsed.assets).toEqual([CHERRY_ASSET]);
  });

  it("books money arriving from outside as capital put in", () => {
    // Capital, not a charge: the row states fees of zero, it does not charge them.
    expect(find(parsed.rows, "nuovo vincolo", "2026-03")).toMatchObject({ buyValue: 625, pnl: 0 });
  });

  it("books interest as a gain and stamp duty as a cost", () => {
    expect(find(parsed.rows, "cedola", "2026-02")).toMatchObject({ buyValue: 0, pnl: 30 });
    expect(find(parsed.rows, "commissione", "2026-02")).toMatchObject({ buyValue: 0, pnl: -5 });
  });

  it("leaves out the moves between the account and its own deposits", () => {
    // The subscription and the repayment are the same asset paying itself.
    // Booking them would count the deposits on top of the money that bought
    // them, which is what makes the account look richer than it is.
    expect(parsed.rows.every((row) => Math.abs(row.buyValue) !== 1000 && Math.abs(row.buyValue) !== 400)).toBe(true);
    expect(parsed.skipped).toContainEqual({
      reason: "moves between the current account and its deposits, which are both this asset",
      count: 2,
    });
  });

  it("dates a movement by its value date, not its accounting date", () => {
    expect(find(parsed.rows, "nuovo vincolo", "2026-03")?.txDate).toBe("2026-03-14");
  });

  it("spans the period the statement declares, not the rows it keeps", () => {
    // The first movement here is a skipped one, and it opens the statement.
    // An import replacing this period has to cover the whole statement, or
    // rows written by a previous import survive it.
    expect(parsed.periodFrom).toBe("2026-01-01");
    expect(parsed.periodTo).toBe("2026-03-15");
  });

  it("values the account at what was paid into it plus what it earned", () => {
    // 625 in, 30 of interest, 5 of stamp duty. The account holds 600 locked in
    // deposits and 50 on the current account, which is the same 650.
    const total = parsed.rows.reduce((sum, row) => sum + row.buyValue + row.pnl, 0);
    expect(Math.round(total * 100) / 100).toBe(650);
  });

  it("refuses a statement whose movements do not explain its balance", () => {
    const broken = CHERRY_PAGE.map((item) =>
      item.str === "625,00" ? at("600,00", item.transform[4], item.transform[5]) : item,
    );
    expect(() => parseStatement([broken])).toThrow(/but the account went from/);
  });
});

describe("document detection", () => {
  it("names the supported statements when it recognises neither", () => {
    expect(() => parseStatement([asPage(["Some other bank", "Statement of account"])])).toThrow(
      /Unrecognised document/,
    );
  });
});

describe("line rebuilding", () => {
  it("groups fragments by baseline and orders them left to right", () => {
    expect(
      linesFromFragments([
        at("€1,000.00", 300, 700.1),
        at("Total", 60, 699.9),
        at("", 200, 700),
        at("second line", 60, 680),
      ]),
    ).toEqual(["Total€1,000.00", "second line"]);
  });
});
