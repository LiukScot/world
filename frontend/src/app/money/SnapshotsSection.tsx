import { lazy, Suspense } from "react";
import { type UseFormReturn } from "react-hook-form";
import { Button } from "../../components/ui/Button";
import { DATE_TIME_INPUT } from "../../components/ui/DateInput";
import { FieldLine } from "../../components/ui/FieldLine";
import { EmptyState, PAGE, PAGE_TITLE } from "../screen-helpers";
import { entryViewLabels } from "../core";
import { FLAT_ACTIONS, FLAT_FORM, FLAT_ROW, FLAT_SHELL, StageField } from "../staged";
import { InlineFeedback, SectionHead } from "../shared";
import { FIELD_LINE_INPUT } from "../../components/ui/FieldLine";
import {
  DELETE_CONFIRM,
  DETAIL_ACTIONS,
  DETAIL_ACTION_BTN,
  DetailGroup,
  ENTRY_CHEVRON,
  ENTRY_DATE,
  ENTRY_EXPANDED,
  ENTRY_PREVIEW,
  ENTRY_ROW,
  ENTRY_SUMMARY,
  PastEntries,
  EntryViewTabs,
  type EntryView,
} from "../entries";
import { formatCurrency, formatTxDate, type Snapshot, type SnapshotFormValues } from "./core";

/** "a", "a and b", "a, b and c" — a sentence, not a dump of a list. */
function listAssets(assets: string[]): string {
  if (assets.length <= 2) return assets.join(" and ");
  return `${assets.slice(0, -1).join(", ")} and ${assets[assets.length - 1]}`;
}

// chart.js is the heaviest thing on this screen and only matters once there
// is something to plot, so it stays out of the panel's own chunk.
const MonthlyRiskChart = lazy(() => import("./MonthlyRiskChart"));

export function SnapshotsSection({
  snapshotForm,
  snapshotMutationState,
  isLoading,
  canSave,
  assetsMissingRisk,
  snapshots,
  confirmDeleteSnapshot,
  onSubmit,
  onDeleteClick,
  onDeleteBlur,
  view,
  onViewChange,
}: {
  snapshotForm: UseFormReturn<SnapshotFormValues>;
  snapshotMutationState: { isSuccess: boolean };
  isLoading: boolean;
  canSave: boolean;
  assetsMissingRisk: string[];
  snapshots: Snapshot[];
  confirmDeleteSnapshot: string | null;
  onSubmit: (values: SnapshotFormValues) => void;
  onDeleteClick: (id: string) => void;
  onDeleteBlur: () => void;
  view: EntryView;
  onViewChange: (next: EntryView) => void;
}) {
  return (
    <section className={PAGE}>
      <EntryViewTabs view={view} onChange={onViewChange} labels={entryViewLabels["money-snapshots"]} className="inline-flex max-mobile:hidden" />
      <h1 className={PAGE_TITLE}>Snapshots</h1>
      {view === "new" ? (
      <form onSubmit={snapshotForm.handleSubmit(onSubmit)} className={FLAT_SHELL}>
        <div className={FLAT_FORM}>
        <div className={FLAT_ROW}>
          <FieldLine
            label="Date"
            id="snapshot-date"
            type="date"
            aria-label="Date"
            className={DATE_TIME_INPUT}
            {...snapshotForm.register("snapshotDate")}
            onClick={(e) => {
              const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
              el.showPicker?.();
            }}
          />
          <StageField
            label="Liquid"
            prompt="The three risk totals are worked out from your transactions and the risk level set on each asset. You only record the date and whatever is sitting liquid."
            htmlFor="snapshot-liquid"
          >
            <input
              id="snapshot-liquid"
              type="number"
              step="0.01"
              placeholder="0"
              className={FIELD_LINE_INPUT}
              {...snapshotForm.register("liquid")}
            />
          </StageField>
        </div>

        </div>

        {assetsMissingRisk.length > 0 ? (
          <InlineFeedback
            className="max-w-[60ch]"
            message={{
              tone: "warning",
              text: `No risk level set for ${listAssets(assetsMissingRisk)}. A snapshot would leave that out of the total, so set it in the Money settings.`,
            }}
          />
        ) : null}

        <div className={FLAT_ACTIONS}>
          {!canSave ? (
            <span className="text-control text-muted self-center">Loading transactions and asset styles…</span>
          ) : null}
          <Button
            type="submit"
            disabled={!canSave || assetsMissingRisk.length > 0}
            variant={snapshotMutationState.isSuccess ? "success" : "primary"}
          >
            {snapshotMutationState.isSuccess ? "✓ Saved" : "Take snapshot"}
          </Button>
        </div>
      </form>
      ) : (
      <div className="grid gap-page content-start min-w-0">
      {/* The risk chart used to render inside the entry list, above the
          rows, as if it were an entry. It is a reading of the whole log,
          so it gets its own titled section. */}
      {snapshots.length > 0 ? (
      <section className="grid gap-3">
        <SectionHead title="Risk over time" variant="dashboard" aside={snapshots.length === 1 ? "1 snapshot" : `${snapshots.length} snapshots`} />
        <div className="grid gap-3 p-3 rounded-md bg-card-soft">
          <Suspense fallback={<p className="text-muted text-control">Loading chart…</p>}>
            <MonthlyRiskChart snapshots={snapshots} />
          </Suspense>
        </div>
      </section>
      ) : null}

      <PastEntries
        title="History"
        isLoading={isLoading}
        loadingText="Loading snapshots..."
        isEmpty={snapshots.length === 0}
        emptyState={
          <EmptyState
            title="No snapshots yet"
            description="A snapshot freezes what your portfolio looks like on a given day. Take a few and the chart will show how the mix shifts over time."
          />
        }
      >
        {snapshots.map((row) => {
          const total = row.lowRisk + row.mediumRisk + row.highRisk + row.liquid;
          return (
            <details key={row.id} className={ENTRY_ROW}>
              <summary className={ENTRY_SUMMARY}>
                <span className={ENTRY_DATE}>{formatTxDate(row.snapshotDate)}</span>
                <span />
                <span className={ENTRY_PREVIEW}>Total</span>
                <span className="text-text">{formatCurrency(total)}</span>
                <span className={ENTRY_CHEVRON} aria-hidden="true">▶</span>
              </summary>
              <div className={ENTRY_EXPANDED}>
                <DetailGroup label="Low risk">{formatCurrency(row.lowRisk)}</DetailGroup>
                <DetailGroup label="Medium risk">{formatCurrency(row.mediumRisk)}</DetailGroup>
                <DetailGroup label="High risk">{formatCurrency(row.highRisk)}</DetailGroup>
                <DetailGroup label="Liquid">{formatCurrency(row.liquid)}</DetailGroup>
                <div className={DETAIL_ACTIONS}>
                  <button
                    type="button"
                    className={`${DETAIL_ACTION_BTN} ${confirmDeleteSnapshot === row.id ? DELETE_CONFIRM : ""}`}
                    onClick={() => onDeleteClick(row.id)}
                    onBlur={onDeleteBlur}
                  >
                    {confirmDeleteSnapshot === row.id ? "Delete?" : "Delete"}
                  </button>
                </div>
              </div>
            </details>
          );
        })}
      </PastEntries>
      </div>
      )}
    </section>
  );
}
