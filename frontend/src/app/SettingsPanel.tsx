import type { InlineMessage, NavItem } from "./core";
import { THEMES } from "./core";
import type { useAuth } from "../hooks/use-auth";
import { useTheme } from "../hooks/use-theme";
import { getErrorMessage } from "../lib";
import { InlineFeedback, SectionHead } from "./shared";
import { MedicinePreselectionSection } from "./MedicinePreselectionSection";
import { Button, buttonClass } from "../components/ui/Button";
import { FieldLine } from "../components/ui/FieldLine";
import { MoneySettings, type MoneySettingsProps } from "./money/MoneySettings";

type SettingsSectionProps = {
  auth: ReturnType<typeof useAuth>;
  purgeConfirmArmed: boolean;
  purgePending: boolean;
  purgeError: InlineMessage | null;
  onPurgeArm: () => void;
  onPurgeConfirm: () => void;
  onPurgeCancel: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  onExportXlsx: () => void;
  onImportXlsx: (file: File) => void;
};

function ThemeBlock() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="grid gap-3">
      <SectionHead title="Theme" aside="applies to every realm" />
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

function AccountBlock({ auth }: Pick<SettingsSectionProps, "auth">) {
  return (
    <div className="flex flex-col gap-2">
      <form
        className="grid gap-3"
        onFocus={auth.clearPasswordStatus}
        onSubmit={auth.changePasswordForm.handleSubmit((v) => auth.changePasswordMutation.mutate(v))}
      >
        <FieldLine label="Current password" type="password" autoComplete="current-password" {...auth.changePasswordForm.register("currentPassword")} />
        <FieldLine label="New password" type="password" autoComplete="new-password" {...auth.changePasswordForm.register("newPassword")} />
        <FieldLine label="Confirm" type="password" autoComplete="new-password" {...auth.changePasswordForm.register("confirmPassword")} />
        <div className="flex justify-end pt-2">
          <Button type="submit" variant="primary" className="mt-[12px]" disabled={auth.changePasswordMutation.isPending}>
            Change password
          </Button>
        </div>
        <InlineFeedback
          message={
            auth.changePasswordMutation.error
              ? { tone: "error", text: getErrorMessage(auth.changePasswordMutation.error) }
              : auth.passwordFeedback
          }
        />
      </form>
    </div>
  );
}

function BackupBlock({
  onExportJson,
  onImportJson,
  onExportXlsx,
  onImportXlsx,
}: Pick<SettingsSectionProps, "onExportJson" | "onImportJson" | "onExportXlsx" | "onImportXlsx">) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-2">
      <div className="flex items-center justify-between gap-5 px-[14px] py-[12px] rounded-md bg-card-strong max-sm:flex-col max-sm:items-stretch">
        <div className="flex flex-col gap-[2px] min-w-0">
          <span className="text-sm font-bold text-text">JSON</span>
          <span className="text-xs text-muted">Full database</span>
        </div>
        <div className="flex gap-2 flex-shrink-0 max-sm:justify-end">
          <Button type="button" size="sm" onClick={onExportJson}>Export</Button>
          <label className={`${buttonClass("default", "sm")} relative overflow-hidden cursor-pointer`}>
            Import
            <input
              type="file"
              accept=".json"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportJson(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
      <div className="flex items-center justify-between gap-5 px-[14px] py-[12px] rounded-md bg-card-strong max-sm:flex-col max-sm:items-stretch">
        <div className="flex flex-col gap-[2px] min-w-0">
          <span className="text-sm font-bold text-text">XLSX</span>
          <span className="text-xs text-muted">Spreadsheet</span>
        </div>
        <div className="flex gap-2 flex-shrink-0 max-sm:justify-end">
          <Button type="button" size="sm" onClick={onExportXlsx}>Export</Button>
          <label className={`${buttonClass("default", "sm")} relative overflow-hidden cursor-pointer`}>
            Import
            <input
              type="file"
              accept=".xlsx,.xls"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportXlsx(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
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

function AccountIdentity({ auth }: Pick<SettingsSectionProps, "auth">) {
  const email = auth.user?.email ?? "—";
  const name = auth.user?.name?.trim();
  return (
    <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-sm">
      <div className="w-[36px] h-[36px] rounded-full grid place-items-center text-sm font-bold font-body text-accent bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] border border-[color-mix(in_srgb,var(--accent)_35%,transparent)]" aria-hidden="true">
        {(name || email).slice(0, 1).toUpperCase()}
      </div>
      <div className="flex flex-col gap-[2px] min-w-0">
        <div className="text-sm font-semibold font-body text-text overflow-hidden text-ellipsis whitespace-nowrap">{name || email.split("@")[0]}</div>
        <div className="text-xs text-muted tabular-nums">{email}</div>
      </div>
      {/* Log out sits with the identity it ends. Right-aligned under the
          password form it read as that form's second step. */}
      <Button
        type="button"
        className="ml-auto flex-none"
        onClick={() => auth.logoutMutation.mutate()}
        disabled={auth.logoutMutation.isPending}
      >
        Log out
      </Button>
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
    case "settings-account":
      return (
        <div className="flex flex-col gap-5 min-w-0">
          <AccountIdentity auth={props.auth} />
          <AccountBlock auth={props.auth} />
        </div>
      );
    case "settings-appearance":
      return <ThemeBlock />;
    case "settings-health":
      return (
        <div className="grid grid-cols-1 gap-5">
          <MedicinePreselectionSection enabled />
          <SectionHead title="Backup" />
          <BackupBlock
            onExportJson={props.onExportJson}
            onImportJson={props.onImportJson}
            onExportXlsx={props.onExportXlsx}
            onImportXlsx={props.onImportXlsx}
          />
          <SectionHead title="Danger zone" />
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
    default:
      return null;
  }
}
