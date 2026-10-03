import { afterEach, describe, expect, test, vi } from "vitest";
import { backupFileName, backupsToDelete, folderUrl, parseBackupList, uploadBackup } from "./webdav";
import { isBackupDue, type WebdavSettings } from "./hooks/use-webdav-backup";

const target = { url: "https://dav.example.com/files/me/", folder: "World Backups/phone", username: "me", password: "pw" };

function listing(names: string[]): string {
  const responses = ["/files/me/World%20Backups/phone/", ...names.map((n) => `/files/me/World%20Backups/phone/${n}`)]
    .map((href) => `<d:response><d:href>${href}</d:href></d:response>`)
    .join("");
  return `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">${responses}</d:multistatus>`;
}

function daily(count: number): string[] {
  return Array.from({ length: count }, (_, i) => backupFileName(new Date(2026, 0, 1 + i)));
}

afterEach(() => vi.unstubAllGlobals());

describe("webdav helpers", () => {
  test("encode each folder segment and keep one trailing slash", () => {
    expect(folderUrl(target)).toBe("https://dav.example.com/files/me/World%20Backups/phone/");
    expect(folderUrl(target, 1)).toBe("https://dav.example.com/files/me/World%20Backups/");
    expect(folderUrl({ url: "https://dav.example.com", folder: "" })).toBe("https://dav.example.com/");
  });

  test("list only backup files, newest first", () => {
    const xml = listing(["world-2026-01-02.sqlite", "notes.txt", "world-2026-01-03.sqlite"]);
    expect(parseBackupList(xml)).toEqual(["world-2026-01-03.sqlite", "world-2026-01-02.sqlite"]);
  });

  test("keep the 30 newest backups", () => {
    const names = daily(32);
    expect(backupsToDelete(names)).toEqual([names[1], names[0]]);
    expect(backupsToDelete(daily(30))).toEqual([]);
  });
});

describe("uploadBackup", () => {
  test("creates the folder, uploads, then deletes backups beyond 30", async () => {
    const existing = daily(31);
    const calls: Array<{ method: string; url: string; body: unknown }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ method: init.method ?? "GET", url, body: init.body });
        if (init.method === "MKCOL") return new Response(null, { status: url.endsWith("Backups/") ? 405 : 201 });
        if (init.method === "PROPFIND") return new Response(listing(existing), { status: 207 });
        return new Response(null, { status: 201 });
      }),
    );

    const database = new Uint8Array([1, 2, 3]);
    await uploadBackup(target, database, new Date(2026, 1, 1));

    expect(calls.map((c) => c.method)).toEqual(["MKCOL", "MKCOL", "PUT", "PROPFIND", "DELETE"]);
    expect(calls[2]).toMatchObject({ url: `${folderUrl(target)}world-2026-02-01.sqlite`, body: database });
    expect(calls[4].url).toBe(`${folderUrl(target)}${existing[0]}`);
  });

  test("reports rejected credentials and uploads nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 })));
    await expect(uploadBackup(target, new Uint8Array([1]))).rejects.toThrow("rejected the username or password");
  });
});

describe("isBackupDue", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  const base: WebdavSettings = {
    url: "https://dav.example.com", folder: "", username: "me", enabled: true,
    lastAttemptAt: null, lastSuccessAt: null, lastError: null,
  };
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

  test("runs when on and the last success is a day old", () => {
    expect(isBackupDue(base, now)).toBe(true);
    expect(isBackupDue({ ...base, lastSuccessAt: hoursAgo(25), lastAttemptAt: hoursAgo(25) }, now)).toBe(true);
    expect(isBackupDue({ ...base, lastSuccessAt: hoursAgo(2), lastAttemptAt: hoursAgo(2) }, now)).toBe(false);
    expect(isBackupDue({ ...base, enabled: false }, now)).toBe(false);
  });

  test("retries a failure at most hourly", () => {
    expect(isBackupDue({ ...base, lastAttemptAt: hoursAgo(0.5), lastError: "401" }, now)).toBe(false);
    expect(isBackupDue({ ...base, lastAttemptAt: hoursAgo(2), lastError: "401" }, now)).toBe(true);
  });
});
