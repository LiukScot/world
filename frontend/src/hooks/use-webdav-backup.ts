import { useEffect } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SecureStoragePlugin } from "capacitor-secure-storage-plugin";
import { apiEnvelopeSchema, apiFetch, getErrorMessage } from "../lib";
import { downloadBackup, listBackups, uploadBackup, type DavTarget } from "../webdav";

const settingsSchema = apiEnvelopeSchema(
  z.object({
    url: z.string(),
    folder: z.string(),
    username: z.string(),
    enabled: z.boolean(),
    lastAttemptAt: z.string().nullable(),
    lastSuccessAt: z.string().nullable(),
    lastError: z.string().nullable(),
  }),
);
const okSchema = apiEnvelopeSchema(z.object({ ok: z.boolean() }));

export type WebdavSettings = z.infer<typeof settingsSchema>["data"];
export type WebdavForm = Pick<WebdavSettings, "url" | "folder" | "username" | "enabled"> & { password: string };

// Loaded on demand: it carries sql.js, which the server build must not bundle.
async function localDatabase() {
  return (await import("../local-backend")).getLocalDatabase();
}

const SETTINGS_KEY = ["webdav-backup"];
const PASSWORD_KEY = ["webdav-password-saved"];
// The Keychain entry. It lives outside the database, so it is never part of
// an uploaded backup.
const KEYCHAIN_KEY = "webdav-password";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

async function readPassword(): Promise<string> {
  // get() rejects for a missing key, so check first rather than catch.
  const { value: keys } = await SecureStoragePlugin.keys();
  if (!keys.includes(KEYCHAIN_KEY)) return "";
  return (await SecureStoragePlugin.get({ key: KEYCHAIN_KEY })).value;
}

const fetchSettings = () =>
  apiFetch("/api/v1/webdav-backup", { method: "GET" }, (raw) => settingsSchema.parse(raw).data);

async function saveSettings({ password, ...settings }: WebdavForm): Promise<void> {
  await apiFetch("/api/v1/webdav-backup", { method: "PUT", body: JSON.stringify(settings) }, (raw) => okSchema.parse(raw));
  // An empty field keeps the saved password.
  if (password) await SecureStoragePlugin.set({ key: KEYCHAIN_KEY, value: password });
}

async function targetFor(settings: WebdavSettings): Promise<DavTarget> {
  if (!settings.url) throw new Error("Enter the WebDAV server address first");
  const password = await readPassword();
  if (!password) throw new Error("No WebDAV password on this device. Enter it in Settings → Backup.");
  return { url: settings.url, folder: settings.folder, username: settings.username, password };
}

async function recordResult(result: { ok: boolean; error?: string }): Promise<void> {
  await apiFetch("/api/v1/webdav-backup/result", { method: "POST", body: JSON.stringify(result) }, (raw) => okSchema.parse(raw));
}

/** Uploads the database now and records the outcome. Rejects with the reason on failure. */
async function runBackup(settings: WebdavSettings): Promise<void> {
  try {
    await uploadBackup(await targetFor(settings), (await localDatabase()).snapshot());
  } catch (error) {
    await recordResult({ ok: false, error: getErrorMessage(error).slice(0, 500) });
    throw error;
  }
  await recordResult({ ok: true });
}

/**
 * iOS runs no app code on a timer, so the daily backup is checked whenever the
 * app comes to the foreground. A failed attempt is retried at most hourly, so
 * every app switch does not raise the same error again.
 */
export function isBackupDue(settings: WebdavSettings, now: Date): boolean {
  if (!settings.enabled || !settings.url) return false;
  const since = (iso: string | null) => (iso ? now.getTime() - Date.parse(iso) : Infinity);
  return since(settings.lastSuccessAt) >= DAY_MS && since(settings.lastAttemptAt) >= HOUR_MS;
}

// Module-level so a remounted effect (StrictMode, hot reload) cannot start a
// second upload alongside the first.
let autoBackupRunning = false;

/** Runs the daily WebDAV backup when the app opens or returns to the foreground. */
export function useAutoBackup(enabled: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const check = async () => {
      if (autoBackupRunning || document.visibilityState !== "visible") return;
      autoBackupRunning = true;
      try {
        const settings = await fetchSettings();
        if (!isBackupDue(settings, new Date())) return;
        await runBackup(settings);
      } catch (error) {
        toast.error(`Automatic backup failed: ${getErrorMessage(error)}`);
      } finally {
        autoBackupRunning = false;
      }
      await queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
    };
    const onVisible = () => {
      check().catch((error: unknown) => console.error("Automatic backup check failed:", error));
    };

    onVisible();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled, queryClient]);
}

export function useWebdavBackup(enabled: boolean) {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
      queryClient.invalidateQueries({ queryKey: PASSWORD_KEY }),
    ]);

  const settingsQuery = useQuery({ queryKey: SETTINGS_KEY, enabled, queryFn: fetchSettings });
  const passwordSavedQuery = useQuery({
    queryKey: PASSWORD_KEY,
    enabled,
    queryFn: async () => (await readPassword()) !== "",
  });

  const saveMutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: async () => {
      await refresh();
      toast.success("Backup settings saved");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // Saves the form first, so the upload uses what is on screen.
  const backupNowMutation = useMutation({
    mutationFn: async (form: WebdavForm) => {
      await saveSettings(form);
      await runBackup(await fetchSettings());
    },
    onSuccess: () => toast.success("Backup uploaded"),
    onError: (error) => toast.error(getErrorMessage(error)),
    onSettled: refresh,
  });

  const listMutation = useMutation({
    mutationFn: async () => listBackups(await targetFor(await fetchSettings())),
  });

  // On success the page reloads with the restored database.
  const restoreMutation = useMutation({
    mutationFn: async (name: string) => {
      const bytes = await downloadBackup(await targetFor(await fetchSettings()), name);
      await (await localDatabase()).replace(bytes);
    },
  });

  return { settingsQuery, passwordSavedQuery, saveMutation, backupNowMutation, listMutation, restoreMutation };
}
