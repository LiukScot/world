import { lazy, Suspense, useId } from "react";
import { EmptyState, PAGE, PAGE_TITLE } from "../screen-helpers";
import {
  CHART_ROW, DASH_CARD_SURFACE, DASH_SECTION, Kpi, KpiSkeleton, KPI_TIER, SectionRow, type KpiTone, type KpiDirection,
} from "../dashboard-cards";
import { formatCurrency, formatPercent, formatTxDate, type AssetStats, type DashboardKpis } from "./core";

const AssetCharts = lazy(() => import("./AssetCharts"));

// Sign and label carry the meaning; the colour only reinforces it.
const toneOf = (n: number): KpiTone => (n > 0 ? "positive" : n < 0 ? "negative" : "flat");
const directionOf = (n: number): KpiDirection => (n > 0 ? "up" : n < 0 ? "down" : "flat");

export function MoneyDashboardSection({
  kpis,
  visibleAssets,
  hiddenAssetCount,
  showZeroAssets,
  onToggleShowZeroAssets,
  isLoading,
}: {
  kpis: DashboardKpis;
  visibleAssets: AssetStats[];
  hiddenAssetCount: number;
  showZeroAssets: boolean;
  onToggleShowZeroAssets: (next: boolean) => void;
  isLoading: boolean;
}) {
  const hasAssets = visibleAssets.length > 0;
  const showZeroId = useId();

  return (
    <section className={PAGE}>
      <h1 className={PAGE_TITLE}>Dashboard</h1>

      <section className={DASH_SECTION} aria-busy={isLoading}>
        <SectionRow title="Portfolio" aside={kpis.lastTxDate ? `updated ${formatTxDate(kpis.lastTxDate)}` : undefined} />
        {isLoading ? (
          <>
            <p className="sr-only">Loading portfolio figures…</p>
            <KpiSkeleton hero />
            <div className={KPI_TIER}>
              <KpiSkeleton />
              <KpiSkeleton />
              <KpiSkeleton />
            </div>
          </>
        ) : (
          <>
            {/* The one number the page is about. Everything else is a
                reading of it, so it sits a tier below. */}
            <Kpi
              hero
              label="Current value"
              value={formatCurrency(kpis.totalCurrent)}
              delta={{
                text: `${formatCurrency(kpis.totalPnl)} · ${formatPercent(kpis.totalPnlPct)} all time`,
                tone: toneOf(kpis.totalPnl),
                direction: directionOf(kpis.totalPnl),
              }}
            />
            <div className={KPI_TIER}>
              <Kpi
                label="Monthly net"
                value={formatCurrency(kpis.monthlyNet)}
                valueTone={toneOf(kpis.monthlyNet)}
                sub={`${formatCurrency(kpis.monthlyIncome)} in · ${formatCurrency(kpis.monthlyExpense)} out`}
              />
              <Kpi label="Assets" value={String(kpis.assetsCount)} />
              <Kpi
                label="Transactions"
                value={String(kpis.txCount)}
                sub={kpis.lastTxDate ? `last ${formatTxDate(kpis.lastTxDate)}` : undefined}
              />
            </div>
          </>
        )}
      </section>

      {hasAssets ? (
        <section className={DASH_SECTION}>
          <SectionRow title="Charts" />
          <div className={CHART_ROW}>
            <Suspense fallback={<p className="text-muted text-control">Loading charts…</p>}>
              <AssetCharts visibleAssets={visibleAssets} />
            </Suspense>
          </div>
        </section>
      ) : null}

      <section className={DASH_SECTION}>
        <SectionRow
          title="By asset"
          aside={
            <label htmlFor={showZeroId} className="inline-flex items-center gap-2 cursor-pointer text-control text-muted">
              <input
                id={showZeroId}
                type="checkbox"
                name="showZeroAssets"
                className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
                checked={showZeroAssets}
                onChange={(e) => onToggleShowZeroAssets(e.target.checked)}
              />
              Show zero-value assets
              {hiddenAssetCount > 0 && !showZeroAssets ? ` (${hiddenAssetCount} hidden)` : ""}
            </label>
          }
        />
        {hasAssets ? (
          <div className="grid gap-3 min-w-0 wide:grid-cols-2">
            {visibleAssets.map((stat) => (
              <article key={stat.asset} className={DASH_CARD_SURFACE}>
                <header className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-[4px] border border-border flex-shrink-0"
                    style={{ background: stat.color }}
                    aria-hidden="true"
                  />
                  <h3 className="m-0 text-sm font-bold text-text truncate">{stat.asset}</h3>
                  <span className="ml-auto text-nano text-muted uppercase tracking-[0.1em] flex-shrink-0">
                    {stat.riskLevel ?? "no risk"}
                  </span>
                </header>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 m-0">
                  <div className="grid gap-1">
                    <dt className="text-nano font-extrabold text-muted uppercase tracking-[0.12em]">Current</dt>
                    <dd className="m-0 text-control font-semibold text-text">{formatCurrency(stat.current)}</dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-nano font-extrabold text-muted uppercase tracking-[0.12em]">Allocation</dt>
                    <dd className="m-0 text-control font-semibold text-text">{formatPercent(stat.allocationPct, 1)}</dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-nano font-extrabold text-muted uppercase tracking-[0.12em]">PnL</dt>
                    <dd className={`m-0 text-control font-semibold ${stat.pnl >= 0 ? "text-success" : "text-danger"}`}>
                      {formatCurrency(stat.pnl)}
                    </dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-nano font-extrabold text-muted uppercase tracking-[0.12em]">PnL %</dt>
                    <dd className={`m-0 text-control font-semibold ${stat.pnl >= 0 ? "text-success" : "text-danger"}`}>
                      {formatPercent(stat.pnlPct)}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title={hiddenAssetCount > 0 ? "Every asset is at zero" : "No assets yet"}
            description={
              hiddenAssetCount > 0
                ? "Everything you hold has been sold off. Turn on the toggle above to keep those assets visible."
                : "Record a transaction and this fills with per-asset value, allocation and PnL. Risk levels are set in Settings."
            }
          />
        )}
      </section>
    </section>
  );
}
