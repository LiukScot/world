import { useId, useState, type FormEvent } from "react";
import { useWebdavBackup, type WebdavForm, type WebdavSettings } from "../hooks/use-webdav-backup";
import { useDataBackup } from "../hooks/use-data-backup";
import { getErrorMessage } from "../lib";
import { Button, buttonClass } from "../components/ui/Button";
import { FieldLine } from "../components/ui/FieldLine";
import { InlineFeedback, SectionHead } from "./shared";
import type { InlineMessage } from "./core";

const ROW = "flex items-center justify-between gap-5 px-[14px] py-[12px] rounded-md bg-card-strong max-sm:flex-col max-sm:items-stretch";
// A switch stays beside its label on a phone: stacked, it reads as a separate control.
const TOGGLE_ROW = "flex items-center justify-between gap-5 px-[14px] py-[12px] rounded-md bg-card-strong";

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function statusMessage(settings: WebdavSettings): InlineMessage {
  const failedLast =
    settings.lastError && settings.lastAttemptAt && (!settings.lastSuccessAt || settings.lastAttemptAt > settings.lastSuccessAt);
  if (failedLast) {
    return { tone: "error", text: `Last attempt failed on ${dateTime.format(new Date(settings.lastAttemptAt!))}: ${settings.lastError}` };
  }
  if (settings.lastSuccessAt) return { tone: "success", text: `Last backup: ${dateTime.format(new Date(settings.lastSuccessAt))}` };
  return { tone: "info", text: "No backup uploaded yet." };
}

function SettingsForm({
  settings,
  passwordSaved,
  backup,
}: {
  settings: WebdavSettings;
  passwordSaved: boolean;
  backup: ReturnType<typeof useWebdavBackup>;
}) {
  const id = useId();
  const [form, setForm] = useState<WebdavForm>({
    url: settings.url,
    folder: settings.folder,
    username: settings.username,
    enabled: settings.enabled,
    password: "",
  });
  const set = <K extends keyof WebdavForm>(key: K, value: WebdavForm[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const busy = backup.saveMutation.isPending || backup.backupNowMutation.isPending;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    backup.saveMutation.mutate(form, { onSuccess: () => set("password", "") });
  };

  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <FieldLine
        label="Server address"
        type="url"
        name="url"
        inputMode="url"
        autoComplete="url"
        placeholder="https://cloud.example.com/remote.php/dav/files/me"
        value={form.url}
        onChange={(e) => set("url", e.target.value)}
      />
      <FieldLine
        label="Folder"
        name="folder"
        placeholder="world-backups"
        value={form.folder}
        onChange={(e) => set("folder", e.target.value)}
      />
      <FieldLine
        label="Username"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        value={form.username}
        onChange={(e) => set("username", e.target.value)}
      />
      <FieldLine
        label="Password"
        type="password"
        name="password"
        autoComplete="current-password"
        placeholder={passwordSaved ? "Saved on this phone — type to replace" : ""}
        value={form.password}
        onChange={(e) => set("password", e.target.value)}
      />
      <div className={`${TOGGLE_ROW} mt-2`}>
        <div className="flex flex-col gap-[2px] min-w-0">
          <label htmlFor={`${id}-enabled`} className="text-sm font-bold text-text cursor-pointer">Back up every day</label>
          <span id={`${id}-hint`} className="text-xs text-muted">
            Runs when you open the app, at most once a day.
            <br />
            The password stays in the iPhone Keychain and is not in the backup.
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            id={`${id}-enabled`}
            type="checkbox"
            name="enabled"
            aria-describedby={`${id}-hint`}
            className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
            checked={form.enabled}
            onChange={(e) => set("enabled", e.target.checked)}
          />
          <span className="text-control text-muted">{form.enabled ? "On" : "Off"}</span>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2 flex-wrap">
        <Button
          type="button"
          disabled={busy}
          onClick={() => backup.backupNowMutation.mutate(form, { onSuccess: () => set("password", "") })}
        >
          {backup.backupNowMutation.isPending ? "Uploading…" : "Back up now"}
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          Save
        </Button>
      </div>
      <InlineFeedback message={statusMessage(settings)} />
    </form>
  );
}

function RestoreBlock({ backup }: { backup: ReturnType<typeof useWebdavBackup> }) {
  const [armed, setArmed] = useState<string | null>(null);
  const { listMutation, restoreMutation } = backup;
  const names = listMutation.data;

  return (
    <div className="grid gap-3">
      <p className="m-0 text-muted text-hint leading-normal">
        Restoring replaces every entry on this phone with the chosen backup.
        <br />
        Save your settings before listing the backups.
      </p>
      {names === undefined ? (
        <div className="flex justify-end">
          <Button type="button" onClick={() => listMutation.mutate()} disabled={listMutation.isPending}>
            {listMutation.isPending ? "Loading…" : "Show backups"}
          </Button>
        </div>
      ) : names.length === 0 ? (
        <InlineFeedback message={{ tone: "info", text: "No backups in this folder yet." }} />
      ) : (
        <ul className="grid gap-2 m-0 p-0 list-none">
          {names.map((name) => (
            <li key={name} className={ROW}>
              <span className="text-sm font-semibold text-text tabular-nums">{name}</span>
              {armed === name ? (
                <div className="flex gap-2 flex-wrap max-sm:justify-end" role="group" aria-label={`Confirm restore of ${name}`}>
                  <Button type="button" size="sm" variant="danger" disabled={restoreMutation.isPending} onClick={() => restoreMutation.mutate(name)}>
                    {restoreMutation.isPending ? "Restoring…" : "Replace all data"}
                  </Button>
                  <Button type="button" size="sm" disabled={restoreMutation.isPending} onClick={() => setArmed(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex max-sm:justify-end">
                  <Button type="button" size="sm" onClick={() => setArmed(name)} disabled={restoreMutation.isPending}>
                    Restore
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <InlineFeedback
        message={
          listMutation.error
            ? { tone: "error", text: getErrorMessage(listMutation.error) }
            : restoreMutation.error
              ? { tone: "error", text: `Restore failed, nothing was changed: ${getErrorMessage(restoreMutation.error)}` }
              : null
        }
      />
    </div>
  );
}

function FileBackupBlock() {
  const backup = useDataBackup();
  const formats = [
    { label: "JSON", hint: "Everything in Health and Money", accept: ".json", onExport: backup.onExportJson, onImport: backup.onImportJson },
    { label: "XLSX", hint: "Spreadsheet, one sheet per table", accept: ".xlsx,.xls", onExport: backup.onExportXlsx, onImport: backup.onImportXlsx },
  ];
  return (
    <div className="grid gap-3">
      <p className="text-control text-muted m-0 max-w-[60ch]">
        Importing replaces the data the file contains; it does not merge.
      </p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-2">
        {formats.map((f) => (
          <div key={f.label} className={ROW}>
            <div className="flex flex-col gap-[2px] min-w-0">
              <span className="text-sm font-bold text-text">{f.label}</span>
              <span className="text-xs text-muted">{f.hint}</span>
            </div>
            <div className="flex gap-2 flex-shrink-0 max-sm:justify-end">
              <Button type="button" size="sm" onClick={f.onExport} aria-label={`Export ${f.label}`}>Export</Button>
              <label className={`${buttonClass("default", "sm")} relative overflow-hidden cursor-pointer`}>
                Import
                <input
                  type="file"
                  accept={f.accept}
                  aria-label={`Import ${f.label}`}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) f.onImport(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WebdavBlocks() {
  const backup = useWebdavBackup(true);
  const { settingsQuery, passwordSavedQuery } = backup;

  if (settingsQuery.error || passwordSavedQuery.error) {
    return <InlineFeedback message={{ tone: "error", text: getErrorMessage(settingsQuery.error ?? passwordSavedQuery.error) }} />;
  }
  if (!settingsQuery.data || passwordSavedQuery.data === undefined) {
    return <p className="text-muted text-control">Loading…</p>;
  }

  return (
    <>
      <SectionHead title="WebDAV" aside="daily copy of the whole database" variant="accent" />
      {/* Keyed on what is stored, so a restore or a save elsewhere resets the fields. */}
      <SettingsForm
        key={`${settingsQuery.data.url}|${settingsQuery.data.folder}|${settingsQuery.data.username}|${settingsQuery.data.enabled}`}
        settings={settingsQuery.data}
        passwordSaved={passwordSavedQuery.data}
        backup={backup}
      />
      <SectionHead title="Restore" variant="accent" />
      <RestoreBlock backup={backup} />
    </>
  );
}

const isDevice = import.meta.env.MODE === "device";

/** Settings → Data: backups of everything, in one place. */
export function DataSection() {
  return (
    <div className="grid grid-cols-1 gap-5">
      <SectionHead title="Backup file" variant="accent" />
      <FileBackupBlock />
      {/* The server has its own backup scripts; WebDAV is for the phone, which holds the only copy. */}
      {isDevice ? <WebdavBlocks /> : null}
    </div>
  );
}
