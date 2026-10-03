import { useId } from "react";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/select";
import { InlineFeedback, SectionHead } from "../shared";
import { EmptyState } from "../screen-helpers";
import type { InlineMessage } from "../core";
import { RISK_LEVELS, type RiskLevel, type StylesMap } from "./core";

export type MoneySettingsProps = {
  showZeroAssets: boolean;
  onToggleShowZeroAssets: (next: boolean) => void;
  styles: StylesMap;
  assets: string[];
  stylesLoading: boolean;
  onChangeStyle: (asset: string, patch: { colorHex?: string | null; riskLevel?: RiskLevel | null }) => void;
  purgeConfirmArmed: boolean;
  purgePending: boolean;
  purgeError: InlineMessage | null;
  onPurgeArm: () => void;
  onPurgeConfirm: () => void;
  onPurgeCancel: () => void;
};

const RISK_OPTIONS = [{ value: "", label: "not set" }, ...RISK_LEVELS.map((r) => ({ value: r, label: r }))];
const DEFAULT_SWATCH = "#34d399";

const ROW = "flex items-center justify-between gap-5 px-[14px] py-[12px] rounded-md bg-card-strong max-sm:flex-col max-sm:items-stretch";
// A switch stays beside its label on a phone: stacked, it reads as a separate control.
const TOGGLE_ROW = "flex items-center justify-between gap-5 px-[14px] py-[12px] rounded-md bg-card-strong";

function PreferencesBlock({ showZeroAssets, onToggleShowZeroAssets }: Pick<MoneySettingsProps, "showZeroAssets" | "onToggleShowZeroAssets">) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={TOGGLE_ROW}>
      <div className="flex flex-col gap-[2px] min-w-0">
        <label htmlFor={id} className="text-sm font-bold text-text cursor-pointer">Show zero-value assets</label>
        <span id={hintId} className="text-xs text-muted">Keep assets you have fully sold off visible in lists and charts. Same switch as the one on the dashboard.</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <input
          id={id}
          type="checkbox"
          name="showZeroAssets"
          aria-describedby={hintId}
          className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
          checked={showZeroAssets}
          onChange={(e) => onToggleShowZeroAssets(e.target.checked)}
        />
        <span className="text-control text-muted">{showZeroAssets ? "On" : "Off"}</span>
      </div>
    </div>
  );
}

// Dragging inside the colour picker fires `input` continuously, and a
// controlled value would PUT the whole styles map on every one of those
// events. Uncontrolled, the browser holds the colour during the drag and only
// the final pick is committed. The caller keys this on the stored value so a
// colour that changes server-side (import, purge) still resets the swatch.
function AssetColorInput({ id, value, onCommit }: { id: string; value: string; onCommit: (colorHex: string) => void }) {
  return (
    <input
      id={id}
      name={id}
      type="color"
      defaultValue={value}
      onBlur={(e) => e.target.value !== value && onCommit(e.target.value)}
      className="w-7 h-7 p-0 rounded-sm border border-border bg-transparent cursor-pointer"
    />
  );
}

function AssetsBlock({ styles, assets, stylesLoading, onChangeStyle }: Pick<MoneySettingsProps, "styles" | "assets" | "stylesLoading" | "onChangeStyle">) {
  if (stylesLoading) return <p className="text-muted text-control">Loading assets…</p>;
  if (assets.length === 0) {
    return (
      <EmptyState
        title="No assets yet"
        description="Assets appear here once you record a transaction against them. Their risk level is what the monthly snapshots are built from."
      />
    );
  }

  return (
    <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
      <p className="text-control text-muted m-0 max-w-[60ch] [grid-column:1/-1]">
        The risk level decides which bucket an asset lands in when a snapshot is taken. An asset
        left unset counts towards none of them.
      </p>
      {assets.map((asset) => {
        const style = styles[asset] ?? { colorHex: null, riskLevel: null };
        const colorId = `asset-color-${asset}`;
        return (
          <div key={asset} className={ROW}>
            <div className="flex items-center gap-3 min-w-0">
              <label htmlFor={colorId} className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                <span className="sr-only">Colour for {asset}</span>
                <AssetColorInput
                  key={style.colorHex ?? DEFAULT_SWATCH}
                  id={colorId}
                  value={style.colorHex ?? DEFAULT_SWATCH}
                  onCommit={(colorHex) => onChangeStyle(asset, { colorHex })}
                />
              </label>
              <span className="text-sm font-bold text-text truncate">{asset}</span>
            </div>
            <div className="w-[160px] flex-shrink-0 max-sm:w-auto">
              <Select
                ariaLabel={`Risk level for ${asset}`}
                value={style.riskLevel ?? ""}
                onValueChange={(value) =>
                  onChangeStyle(asset, { riskLevel: value === "" ? null : (value as RiskLevel) })
                }
                options={RISK_OPTIONS}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DangerBlock({ purgeConfirmArmed, purgePending, purgeError, onPurgeArm, onPurgeConfirm, onPurgeCancel }: Pick<MoneySettingsProps, "purgeConfirmArmed" | "purgePending" | "purgeError" | "onPurgeArm" | "onPurgeConfirm" | "onPurgeCancel">) {
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 px-3 py-2 bg-[color-mix(in_srgb,var(--danger)_7%,var(--card))] border-l-2 border-[color-mix(in_srgb,var(--danger)_55%,transparent)] rounded-sm text-muted text-hint leading-normal">
        Permanently deletes every transaction, monthly movement, snapshot and asset style on this
        account. Your health data is not touched. This cannot be undone.
      </p>
      {purgeConfirmArmed ? (
        <div
          className="mt-3 p-3 border border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,var(--card))] grid gap-3"
          role="group"
          aria-label="Confirm purge all money data"
        >
          <InlineFeedback message={{ tone: "warning", text: "This permanently deletes all money data for this account." }} />
          <div className="flex gap-3 items-center flex-wrap">
            <Button type="button" variant="danger" onClick={onPurgeConfirm} disabled={purgePending}>
              {purgePending ? "Purging..." : "Confirm purge money data"}
            </Button>
            <Button type="button" onClick={onPurgeCancel} disabled={purgePending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end pt-2">
          <Button type="button" variant="danger" onClick={onPurgeArm}>
            Purge money data
          </Button>
        </div>
      )}
      <InlineFeedback message={purgeError} />
    </div>
  );
}

export function MoneySettings(props: MoneySettingsProps) {
  return (
    <div className="grid grid-cols-1 gap-5">
      <SectionHead title="Preferences" variant="accent" />
      <PreferencesBlock {...props} />
      <SectionHead title="Assets" variant="accent" />
      <AssetsBlock {...props} />
      <SectionHead title="Danger zone" variant="accent" />
      <DangerBlock {...props} />
    </div>
  );
}
