import { type CSSProperties, lazy, Suspense } from "react";
import type { WellbeingChartView } from "./WellbeingChart";
import {
  type DashboardConnection,
  type DashboardInsight,
  type MemorableDay,
  type DashboardQuickRange,
  type WellbeingSeries,
  type WellbeingSeriesKey,
  calcDeltaPercent,
  dashboardQuickRanges,
  formatDelta,
} from "./core";
import { EmptyState, PAGE, PAGE_TITLE } from "./screen-helpers";
import {
  DASH_CARD_SURFACE, DASH_SECTION, Kpi, KPI_TIER, SectionRow,
} from "./dashboard-cards";
import { toneOfDelta } from "./dashboard-tone";
import { FIELD_LINE_LABEL } from "../components/ui/FieldLine";
import { DateInput } from "../components/ui/DateInput";

const WellbeingChart = lazy(() => import("./WellbeingChart"));

const QUICK_RANGE_BASE =
  "px-3 py-1 text-xs font-semibold font-body border-0 rounded-full cursor-pointer transition-[color,background] duration-150 ease-[ease] shadow-none";
const QUICK_RANGE_IDLE =
  "text-muted bg-[color-mix(in_srgb,var(--text)_5%,transparent)] hover:text-text hover:bg-[color-mix(in_srgb,var(--text)_10%,transparent)] [[data-theme=oled]_&]:bg-card-soft [[data-theme=oled]_&]:hover:bg-[color-mix(in_srgb,white_8%,var(--card-soft))]";
const QUICK_RANGE_ACTIVE = "text-accent bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]";

const CONFIDENCE_TONE: Record<string, string> = {
  strong: "text-success bg-[color-mix(in_srgb,var(--success)_14%,transparent)]",
  medium: "text-warning bg-[color-mix(in_srgb,var(--warning)_14%,transparent)]",
  weak: "text-muted bg-[color-mix(in_srgb,var(--muted)_14%,transparent)]",
};

export function DashboardSection({
  dashboardFrom,
  dashboardTo,
  activeQuickRange,
  isLoading,
  hasEntriesInRange,
  hasEntriesOverall,
  onDateChange,
  onQuickRange,
  dashboardCards,
  dashboardInsights,
  dashboardConnections,
  wellbeingSeries,
  graphSelection,
  onGraphToggle,
  wellbeingChart,
  anniversaryCards,
}: {
  dashboardFrom: string;
  dashboardTo: string;
  activeQuickRange: DashboardQuickRange;
  isLoading: boolean;
  hasEntriesInRange: boolean;
  hasEntriesOverall: boolean;
  onDateChange: (field: "from" | "to", value: string) => void;
  onQuickRange: (range: DashboardQuickRange) => void;
  dashboardCards: Array<{ label: string; emoji: string; value: number | null; formattedValue: string; previous: number | null; invertDelta?: boolean; primary?: boolean }>;
  dashboardInsights: DashboardInsight[];
  dashboardConnections: DashboardConnection[];
  wellbeingSeries: WellbeingSeries[];
  graphSelection: Record<WellbeingSeriesKey, boolean>;
  onGraphToggle: (key: WellbeingSeriesKey, checked: boolean) => void;
  wellbeingChart: WellbeingChartView;
  anniversaryCards: MemorableDay[];
}) {
  const heroCard = dashboardCards.find((card) => card.primary) ?? dashboardCards[0];
  const tierCards = dashboardCards.filter((card) => card !== heroCard);
  const kpiProps = (card: (typeof dashboardCards)[number]) => {
    const deltaPct = calcDeltaPercent(card.value, card.previous);
    const delta = deltaPct === null ? null : formatDelta(deltaPct, Boolean(card.invertDelta));
    return {
      label: `${card.emoji} ${card.label}`.trim(),
      value: card.formattedValue,
      delta: delta ? { text: delta.text, tone: toneOfDelta(delta.className), direction: delta.direction } : undefined,
    };
  };

  return (
    <section className={PAGE}>
      <h1 className={PAGE_TITLE}>Dashboard</h1>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-2 flex-1 mobile:flex-none" htmlFor="dashboard-from">
          <span className={FIELD_LINE_LABEL}>From</span>
          <DateInput id="dashboard-from" name="dashboard-from" value={dashboardFrom} onChange={(v) => onDateChange("from", v)} ariaLabel="From date" />
        </label>
        <label className="flex flex-col gap-2 flex-1 mobile:flex-none" htmlFor="dashboard-to">
          <span className={FIELD_LINE_LABEL}>To</span>
          <DateInput id="dashboard-to" name="dashboard-to" value={dashboardTo} onChange={(v) => onDateChange("to", v)} ariaLabel="To date" />
        </label>
        <div className="flex gap-2 flex-wrap">
          {dashboardQuickRanges.map((range) => (
            <button
              type="button"
              key={range.value}
              aria-pressed={activeQuickRange === range.value}
              className={`${QUICK_RANGE_BASE} ${activeQuickRange === range.value ? QUICK_RANGE_ACTIVE : QUICK_RANGE_IDLE}`}
              onClick={() => onQuickRange(range.value)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted text-control">Loading dashboard data...</p>
      ) : (
        <>
          {!hasEntriesInRange ? (
            <EmptyState
              title={hasEntriesOverall ? "No entries in this date range" : "No health entries yet"}
              description={hasEntriesOverall
                ? "Try widening the dates, or add a new diary or pain entry to start filling this range."
                : "Your averages will appear here after you log your first diary or pain entry."}
            />
          ) : null}

          {anniversaryCards.length > 0 ? (
            <section className={DASH_SECTION}>
              <SectionRow title="Anniversaries today" />
              <div className="grid gap-3 min-w-0 grid-cols-[repeat(2,minmax(0,1fr))] wide:grid-cols-4">
                {anniversaryCards.map((card) => (
                  <Kpi
                    key={card.id}
                    label={`${card.emoji || "✨"} ${card.title}`}
                    value={card.description || "Today"}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className={DASH_SECTION}>
            <SectionRow title="Averages" aside={`${dashboardFrom} – ${dashboardTo}`} />
            <div data-testid="averages" className="grid gap-3 min-w-0">
              {/* Mood leads, not whichever card the list happens to start
                  with: it is the reading the page is about, where the
                  entry counts are how much data backs it. */}
              {heroCard ? <Kpi hero {...kpiProps(heroCard)} /> : null}
              <div className={KPI_TIER}>
                {tierCards.map((card) => (
                  <Kpi key={card.label} {...kpiProps(card)} />
                ))}
              </div>
            </div>
          </section>

          <section className={DASH_SECTION}>
            <SectionRow title="Metrics over time" />
            <div className={DASH_CARD_SURFACE}>
              <div className="flex flex-wrap gap-2">
                {wellbeingSeries.map((series) => {
                  const checked = graphSelection[series.key] ?? true;
                  const hasData = series.points.length > 0;
                  return (
                    <label
                      key={series.key}
                      data-testid="series-toggle"
                      className={`inline-flex items-center gap-2 border-0 rounded-full px-3 py-1 bg-card-strong text-micro font-semibold leading-none shadow-none${hasData ? "" : " opacity-50"}`}
                      style={{ "--series-color": series.color } as CSSProperties}
                    >
                      <input
                        type="checkbox"
                        className="w-auto accent-[var(--series-color,var(--accent))]"
                        checked={checked && hasData}
                        disabled={!hasData}
                        onChange={(event) => onGraphToggle(series.key, event.target.checked)}
                      />
                      <span className="text-text">{series.label}</span>
                    </label>
                  );
                })}
              </div>

              {wellbeingChart.hasVisibleData ? (
                <div className="relative w-full min-h-[320px] h-[360px]">
                  <Suspense fallback={<p className="text-muted text-control">Loading chart…</p>}>
                    <WellbeingChart data={wellbeingChart.data} options={wellbeingChart.options} />
                  </Suspense>
                </div>
              ) : (
                <p className="text-muted text-control">
                  {wellbeingChart.hasAnyData ? "Toggle on a metric to see it." : hasEntriesOverall ? "No chart data in this date range." : "No chart data yet. Add a diary or pain entry to get started."}
                </p>
              )}
            </div>
          </section>

          <section className={DASH_SECTION}>
            <SectionRow title="At a glance" />
            <div className="grid gap-3 items-start min-w-0 wide:grid-cols-2">
              <article data-testid="insights" className={DASH_CARD_SURFACE}>
                {dashboardInsights.map((insight) => (
                  <div key={insight.title} className="grid gap-1">
                    <strong className="text-nano font-extrabold tracking-[0.14em] uppercase text-muted">{insight.title}</strong>
                    <p className="m-0 text-text text-control leading-normal">{insight.detail}</p>
                  </div>
                ))}
              </article>

              {dashboardConnections.length > 0 ? (
                dashboardConnections.map((connection) => (
                  <article key={connection.title} className={DASH_CARD_SURFACE}>
                    <span className="text-nano font-extrabold tracking-[0.14em] uppercase text-muted">{connection.title}</span>
                    <strong className="m-0 text-text text-control font-semibold">{connection.summary}</strong>
                    <p className="m-0 text-muted text-control leading-normal">{connection.detail}</p>
                    <span className={`justify-self-start rounded-full px-2 py-0.5 text-micro font-bold ${CONFIDENCE_TONE[connection.confidence] ?? CONFIDENCE_TONE.weak}`}>{connection.confidence} confidence</span>
                  </article>
                ))
              ) : (
                <article className={DASH_CARD_SURFACE}>
                  <span className="text-nano font-extrabold tracking-[0.14em] uppercase text-muted">Patterns</span>
                  <p className="text-control font-semibold text-text m-0">No connection signals yet</p>
                  <p className="max-w-[60ch] text-control text-muted leading-normal m-0">Log more overlapping diary and pain entries to unlock pattern cards here.</p>
                </article>
              )}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
