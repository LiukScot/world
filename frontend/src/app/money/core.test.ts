import { describe, expect, test } from "vitest";
import {
  amountIn,
  assetsWithoutRisk,
  computeKpis,
  computePerAsset,
  computeRiskTotals,
  filterVisibleAssets,
  formatCurrency,
  formatPercent,
  formatTxDate,
  freshMovementDefaults,
  freshSnapshotDefaults,
  freshTxDefaults,
  movementFormSchema,
  snapshotFormSchema,
  toCadence,
  TIPO_OPTIONS,
  tipoShowsBuyValue,
  tipoShowsPnl,
  todayIso,
  transactionSchema,
} from "./core";

describe("tipo field visibility", () => {
  test("only 'nuovo vincolo' books a buy value", () => {
    expect(tipoShowsBuyValue("nuovo vincolo")).toBe(true);
    expect(tipoShowsPnl("nuovo vincolo")).toBe(false);
  });

  test("every other tipo records PnL instead", () => {
    for (const tipo of TIPO_OPTIONS.filter((t) => t !== "nuovo vincolo")) {
      expect(tipoShowsBuyValue(tipo)).toBe(false);
      expect(tipoShowsPnl(tipo)).toBe(true);
    }
  });

  // The two are exclusive by construction: the form renders one field, and the
  // hook zeroes whichever is hidden. If both could be true the amount would be
  // double-counted into currentValue.
  test("the two are always exclusive", () => {
    for (const tipo of [...TIPO_OPTIONS, "something unknown"]) {
      expect(tipoShowsBuyValue(tipo)).toBe(!tipoShowsPnl(tipo));
    }
  });
});

describe("form defaults", () => {
  test("start on today with empty amounts", () => {
    const d = freshTxDefaults();
    expect(d.txDate).toBe(todayIso());
    expect(d.buyValue).toBe("");
    expect(d.pnl).toBe("");
    expect(d.tipo).toBe("nuovo vincolo");
  });

  test("todayIso is a local calendar date, not a UTC-shifted one", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(todayIso()).toBe(expected);
  });
});

describe("formatting", () => {
  test("renders euros and survives a non-finite value", () => {
    expect(formatCurrency(1234.5)).toContain("€");
    expect(formatCurrency(Number.NaN)).toBe(formatCurrency(0));
  });

  test("renders a percentage the reader's locale agrees with", () => {
    // The value is already a percentage, so it must not be multiplied again.
    expect(formatPercent(12.5)).toBe(new Intl.NumberFormat(undefined, {
      style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(0.125));
    expect(formatPercent(12.34, 1)).toContain("12");
    expect(formatPercent(Number.NaN)).toBe(formatPercent(0));
  });

  test("falls back to a dash on an unparseable date", () => {
    expect(formatTxDate("not-a-date")).toBe("—");
    expect(formatTxDate("2026-03-14")).not.toBe("—");
  });

  test("renders the stored calendar day, not the UTC instant", () => {
    // The suite runs behind UTC, so parsing this as an instant would render
    // the 13th. The stored value is a calendar day and must survive as one.
    expect(formatTxDate("2026-03-14")).toContain("14");
  });
});

describe("transactionSchema", () => {
  test("rejects a payload missing a required field", () => {
    expect(transactionSchema.safeParse({ id: "tx-1" }).success).toBe(false);
  });

  test("accepts a full row", () => {
    const row = {
      id: "tx-1",
      txDate: "2026-03-14",
      asset: "ETF-A",
      tipo: "cedola",
      derivedType: "return",
      buyValue: 0,
      pnl: 12.5,
      currentValue: 12.5,
      note: "",
      createdAt: "2026-03-14 10:00:00",
      updatedAt: "2026-03-14 10:00:00",
    };
    expect(transactionSchema.safeParse(row).success).toBe(true);
  });
});

describe("assetsWithoutRisk", () => {
  const tx = (asset: string, currentValue: number) => ({
    id: `tx-${asset}-${currentValue}`, txDate: "2026-01-01", asset, tipo: "nuovo vincolo",
    derivedType: "buy", buyValue: currentValue, pnl: 0, currentValue, note: "",
    createdAt: "", updatedAt: "",
  });
  const style = (riskLevel: string | null) => ({ colorHex: null, riskLevel });

  test("names the assets a snapshot would drop, sorted", () => {
    expect(
      assetsWithoutRisk([tx("zeta", 10), tx("alpha", 20), tx("classified", 30)], {
        classified: style("low"),
        alpha: style(null),
      }),
    ).toEqual(["alpha", "zeta"]);
  });

  test("counts an unknown risk level as missing, like the snapshot does", () => {
    expect(assetsWithoutRisk([tx("A", 10)], { A: style("extreme") })).toEqual(["A"]);
  });

  test("leaves out an asset sold down to zero, which no snapshot would miss", () => {
    expect(assetsWithoutRisk([tx("A", 100), tx("A", -100)], {})).toEqual([]);
  });

  test("says nothing when every asset carries a level", () => {
    expect(assetsWithoutRisk([tx("A", 10), tx("B", 20)], { A: style("low"), B: style("high") })).toEqual([]);
  });
});

describe("computeRiskTotals", () => {
  const tx = (asset: string, currentValue: number) => ({
    id: `tx-${asset}-${currentValue}`, txDate: "2026-01-01", asset, tipo: "nuovo vincolo",
    derivedType: "buy", buyValue: currentValue, pnl: 0, currentValue, note: "",
    createdAt: "", updatedAt: "",
  });
  const style = (riskLevel: string | null) => ({ colorHex: null, riskLevel });

  test("buckets each asset by its risk level", () => {
    const totals = computeRiskTotals(
      [tx("A", 100), tx("B", 50), tx("C", 25)],
      { A: style("low"), B: style("medium"), C: style("high") },
    );
    expect(totals).toEqual({ low: 100, medium: 50, high: 25 });
  });

  test("sums several transactions on the same asset", () => {
    const totals = computeRiskTotals([tx("A", 100), tx("A", 40)], { A: style("low") });
    expect(totals.low).toBe(140);
  });

  // An asset nobody classified must not be quietly counted as low risk — that
  // would overstate the safe share of the portfolio.
  test("ignores assets with no risk level, and unknown levels", () => {
    const totals = computeRiskTotals(
      [tx("A", 100), tx("B", 999), tx("C", 999)],
      { A: style("low"), B: style(null), C: style("extreme") },
    );
    expect(totals).toEqual({ low: 100, medium: 0, high: 0 });
  });

  test("ignores an asset missing from the styles map entirely", () => {
    expect(computeRiskTotals([tx("Ghost", 500)], {})).toEqual({ low: 0, medium: 0, high: 0 });
  });

  test("rounds to cents so floating point noise never reaches the database", () => {
    const totals = computeRiskTotals([tx("A", 0.1), tx("A", 0.2)], { A: style("low") });
    expect(totals.low).toBe(0.3);
  });

  test("keeps negative values, which a sold-off asset legitimately has", () => {
    const totals = computeRiskTotals([tx("A", 100), tx("A", -130)], { A: style("high") });
    expect(totals.high).toBe(-30);
  });

  test("returns zeros with no transactions", () => {
    expect(computeRiskTotals([], { A: style("low") })).toEqual({ low: 0, medium: 0, high: 0 });
  });
});

describe("movement and snapshot forms", () => {
  test("empty amount coerces to 0 on submit", () => {
    expect(
      movementFormSchema.parse({ name: "Rent", direction: "expense", amount: "", cadence: "monthly", note: "" }).amount,
    ).toBe(0);
    expect(snapshotFormSchema.parse({ snapshotDate: "2026-01-31", liquid: "" }).liquid).toBe(0);
  });

  test("rejects an unknown direction and a negative amount", () => {
    expect(movementFormSchema.safeParse({ name: "X", direction: "sideways", amount: 1, cadence: "monthly" }).success).toBe(false);
    expect(movementFormSchema.safeParse({ name: "X", direction: "income", amount: -1, cadence: "monthly" }).success).toBe(false);
  });

  test("rejects an unknown cadence", () => {
    expect(movementFormSchema.safeParse({ name: "X", direction: "income", amount: 1, cadence: "weekly" }).success).toBe(false);
  });

  test("movement defaults start on a monthly income with an empty amount", () => {
    expect(freshMovementDefaults()).toEqual({ name: "", direction: "income", amount: "", cadence: "monthly", note: "" });
  });

  test("converts a row into the period being shown, and leaves it alone otherwise", () => {
    expect(amountIn({ amount: 1200, cadence: "annual" }, "monthly")).toBe(100);
    expect(amountIn({ amount: 1200, cadence: "annual" }, "annual")).toBe(1200);
    expect(amountIn({ amount: 100, cadence: "monthly" }, "annual")).toBe(1200);
    expect(amountIn({ amount: 100, cadence: "monthly" }, "monthly")).toBe(100);
  });

  test("an unrecognised cadence converts as a monthly one", () => {
    expect(amountIn({ amount: 100, cadence: "weekly" }, "annual")).toBe(1200);
  });

  // The API types cadence as a plain string, so an unexpected value must land
  // on the safe side rather than divide an amount it shouldn't.
  test("an unknown cadence reads as monthly", () => {
    expect(toCadence("weekly")).toBe("monthly");
    expect(toCadence("annual")).toBe("annual");
  });

  test("snapshot defaults start on today", () => {
    expect(freshSnapshotDefaults().snapshotDate).toBe(todayIso());
  });
});

describe("computePerAsset", () => {
  const tx = (asset: string, buyValue: number, pnl: number, currentValue: number) => ({
    id: `tx-${asset}-${currentValue}`, txDate: "2026-01-01", asset, tipo: "nuovo vincolo",
    derivedType: "buy", buyValue, pnl, currentValue, note: "", createdAt: "", updatedAt: "",
  });

  test("folds several transactions into one row per asset", () => {
    const stats = computePerAsset([tx("A", 100, 10, 110), tx("A", 50, -5, 45), tx("B", 200, 0, 200)], {});
    expect(stats).toHaveLength(2);
    const a = stats.find((s) => s.asset === "A")!;
    expect(a).toMatchObject({ buyTotal: 150, pnl: 5, current: 155 });
  });

  test("allocation is the share of total current value", () => {
    const stats = computePerAsset([tx("A", 0, 0, 750), tx("B", 0, 0, 250)], {});
    expect(stats.find((s) => s.asset === "A")!.allocationPct).toBe(75);
    expect(stats.find((s) => s.asset === "B")!.allocationPct).toBe(25);
  });

  test("PnL percent is relative to what was put in", () => {
    expect(computePerAsset([tx("A", 200, 50, 250)], {})[0]!.pnlPct).toBe(25);
  });

  // Dividing by a zero total or a zero buy would give NaN/Infinity, which
  // would then render as "NaN%" in the cards.
  test("no division by zero when nothing was bought or everything is at zero", () => {
    expect(computePerAsset([tx("A", 0, 0, 0)], {})[0]).toMatchObject({ allocationPct: 0, pnlPct: 0 });
  });

  test("uses the asset's own colour when set, a palette colour otherwise", () => {
    const stats = computePerAsset([tx("A", 0, 0, 1), tx("B", 0, 0, 1)], {
      A: { colorHex: "#123456", riskLevel: null },
    });
    expect(stats.find((s) => s.asset === "A")!.color).toBe("#123456");
    expect(stats.find((s) => s.asset === "B")!.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  test("ignores a malformed colour rather than passing it to chart.js", () => {
    const stats = computePerAsset([tx("A", 0, 0, 1)], { A: { colorHex: "red", riskLevel: null } });
    expect(stats[0]!.color).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("filterVisibleAssets", () => {
  const stat = (asset: string, current: number) => ({
    asset, buyTotal: 0, pnl: 0, current, allocationPct: 0, pnlPct: 0, color: "#000000", riskLevel: null,
  });

  test("hides assets sitting at zero unless asked to show them", () => {
    const stats = [stat("A", 100), stat("B", 0)];
    expect(filterVisibleAssets(stats, false).map((s) => s.asset)).toEqual(["A"]);
    expect(filterVisibleAssets(stats, true)).toHaveLength(2);
  });

  // A sold-off asset lands a hair off zero after rounding, not exactly on it.
  test("treats a rounding remainder as zero", () => {
    expect(filterVisibleAssets([stat("A", 0.00001)], false)).toHaveLength(0);
    expect(filterVisibleAssets([stat("A", 0.01)], false)).toHaveLength(1);
  });

  test("keeps a negative balance visible", () => {
    expect(filterVisibleAssets([stat("A", -50)], false)).toHaveLength(1);
  });
});

describe("computeKpis", () => {
  const tx = (asset: string, pnl: number, currentValue: number, buyValue = 0) => ({
    id: `tx-${asset}-${currentValue}`, txDate: "2026-03-0" + (currentValue % 9), asset, tipo: "x",
    derivedType: "buy", buyValue, pnl, currentValue, note: "", createdAt: "", updatedAt: "",
  });
  const mm = (direction: string, amount: number, cadence = "monthly") => ({
    id: `mm-${direction}-${amount}-${cadence}`, name: "x", direction, amount, cadence, note: "",
    createdAt: "", updatedAt: "",
  });

  test("totals value, PnL and counts distinct assets", () => {
    const k = computeKpis([tx("A", 10, 100), tx("A", 5, 50), tx("B", -2, 20)], []);
    expect(k).toMatchObject({ totalCurrent: 170, totalPnl: 13, assetsCount: 2, txCount: 3 });
  });

  test("total PnL percent is the whole portfolio's PnL over what was put in", () => {
    expect(computeKpis([tx("A", 50, 250, 200), tx("B", 50, 350, 300)], []).totalPnlPct).toBe(20);
  });

  test("total PnL percent stays 0 when nothing was bought", () => {
    expect(computeKpis([tx("A", 50, 50)], []).totalPnlPct).toBe(0);
    expect(computeKpis([], []).totalPnlPct).toBe(0);
  });

  test("monthly net is income minus expense", () => {
    const k = computeKpis([], [mm("income", 2000), mm("expense", 850), mm("expense", 45)]);
    expect(k).toMatchObject({ monthlyIncome: 2000, monthlyExpense: 895, monthlyNet: 1105 });
  });

  test("an annual movement contributes a twelfth of itself to the monthly figures", () => {
    const k = computeKpis([], [mm("expense", 1200, "annual"), mm("income", 1200, "monthly")]);
    expect(k).toMatchObject({ monthlyIncome: 1200, monthlyExpense: 100, monthlyNet: 1100 });
  });

  test("last transaction is the head, since the API returns newest first", () => {
    expect(computeKpis([tx("A", 0, 3), tx("B", 0, 1)], []).lastTxDate).toBe("2026-03-03");
    expect(computeKpis([], []).lastTxDate).toBeNull();
  });
});
