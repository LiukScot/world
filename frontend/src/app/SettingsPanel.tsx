import type { InlineMessage, NavItem } from "./core";
import { THEMES } from "./core";
import { useTheme } from "../hooks/use-theme";
import { InlineFeedback, SectionHead } from "./shared";
import { MedicinePreselectionSection } from "./MedicinePreselectionSection";
import { Button } from "../components/ui/Button";
import { MoneySettings, type MoneySettingsProps } from "./money/MoneySettings";
import { DataSection } from "./DataSection";

type SettingsSectionProps = {
  purgeConfirmArmed: boolean;
  purgePending: boolean;
  purgeError: InlineMessage | null;
  onPurgeArm: () => void;
  onPurgeConfirm: () => void;
  onPurgeCancel: () => void;
};

function ThemeBlock() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="grid gap-3">
      <SectionHead title="Theme" aside="applies to every realm" variant="accent" />
      {/* Named cards, not bare colour circles: the swatches were the only
          thing telling the three apart, and colour alone is not a label
          you can read, search or hear. */}
      {/* Native radios, visually hidden inside the cards: one tab stop and
          arrow-key selection come with the input, where a div with
          role="radio" would owe both by hand. */}
      <div className="grid gap-3 grid-cols-2 wide:grid-cols-3">
        {THEMES.map((t) => {
          const selected = t.id === theme;
          return (
            <label
              key={t.id}
              className={`grid gap-2 content-start p-3 text-left bg-card-soft rounded-md cursor-pointer border has-[:focus-visible]:shadow-[0_0_0_2px_var(--ring)] ${selected ? "border-text" : "border-transparent hover:border-border"}`}
            >
              <input
                type="radio"
                name="theme"
                value={t.id}
                checked={selected}
                onChange={() => setTheme(t.id)}
                className="sr-only"
              />
              <span
                className="grid content-between h-14 p-2 rounded-sm border border-[color-mix(in_srgb,var(--border)_45%,transparent)]"
                style={{ background: t.bg }}
                aria-hidden="true"
              >
                <span className="h-[7px] w-[70%] rounded-[4px]" style={{ background: t.card }} />
                <span className="h-[7px] w-[40%] rounded-[4px]" style={{ background: t.text }} />
              </span>
              <span className="flex items-center gap-1.5 text-control font-semibold text-text">
                {selected ? <span className="text-success font-extrabold" aria-hidden="true">✓</span> : null}
                {t.label}
              </span>
              <span className="text-micro text-muted-soft">{t.hint}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function DangerBlock({
  purgeConfirmArmed,
  purgePending,
  purgeError,
  onPurgeArm,
  onPurgeConfirm,
  onPurgeCancel,
}: Pick<SettingsSectionProps, "purgeConfirmArmed" | "purgePending" | "purgeError" | "onPurgeArm" | "onPurgeConfirm" | "onPurgeCancel">) {
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 px-3 py-2 bg-[color-mix(in_srgb,var(--danger)_7%,var(--card))] border-l-2 border-[color-mix(in_srgb,var(--danger)_55%,transparent)] rounded-sm text-muted text-hint leading-normal">
        Permanently deletes all diary entries, pain logs, CBT/DBT records, and stored preferences for this account. This cannot be undone.
      </p>
      {purgeConfirmArmed ? (
        <div className="mt-3 p-3 border border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] rounded-md bg-[color-mix(in_srgb,var(--danger)_8%,var(--card))] grid gap-3" role="group" aria-label="Confirm purge all data">
          <InlineFeedback
            message={{
              tone: "warning",
              text: "This permanently deletes all diary, pain, CBT, DBT, memorable days, option lists and preference data for this account.",
            }}
          />
          <div className="flex gap-3 items-center flex-wrap [grid-column:1/-1]">
            <Button type="button" variant="danger" onClick={onPurgeConfirm} disabled={purgePending}>
              {purgePending ? "Purging..." : "Confirm purge all data"}
            </Button>
            <Button type="button" onClick={onPurgeCancel} disabled={purgePending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end pt-2">
          <Button type="button" variant="danger" onClick={onPurgeArm}>
            Purge all data
          </Button>
        </div>
      )}
      <InlineFeedback message={purgeError} />
    </div>
  );
}

// One screen per nav item of the Settings realm. The tab strip is gone: the
// sections are sidebar entries now, which is what made Settings a realm.
export function SettingsScreen({ nav, money, ...props }: SettingsSectionProps & {
  nav: NavItem;
  money: MoneySettingsProps;
}) {
  switch (nav) {
    case "settings-appearance":
      return <ThemeBlock />;
    case "settings-health":
      return (
        <div className="grid grid-cols-1 gap-5">
          <MedicinePreselectionSection enabled />
          <SectionHead title="Danger zone" variant="accent" />
          <DangerBlock
            purgeConfirmArmed={props.purgeConfirmArmed}
            purgePending={props.purgePending}
            purgeError={props.purgeError}
            onPurgeArm={props.onPurgeArm}
            onPurgeConfirm={props.onPurgeConfirm}
            onPurgeCancel={props.onPurgeCancel}
          />
        </div>
      );
    case "settings-money":
      return <MoneySettings {...money} />;
    case "settings-data":
      return <DataSection />;
    default:
      return null;
  }
}
