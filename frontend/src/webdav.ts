import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { format } from "date-fns";
import { fromBase64, toBase64 } from "./save-file";

/** How many daily backups stay in the WebDAV folder. */
export const KEEP_BACKUPS = 30;
const BACKUP_FILE = /^world-\d{4}-\d{2}-\d{2}\.sqlite$/;

export type DavTarget = { url: string; folder: string; username: string; password: string };

type DavResponse = { status: number; text: string; bytes: Uint8Array };

/** One file per local calendar day: a second backup the same day replaces the first. */
export function backupFileName(date: Date): string {
  return `world-${format(date, "yyyy-MM-dd")}.sqlite`;
}

/** The names of the backups beyond the newest `keep`, oldest last. */
export function backupsToDelete(names: string[], keep = KEEP_BACKUPS): string[] {
  return names.filter((name) => BACKUP_FILE.test(name)).sort().reverse().slice(keep);
}

/** The backup file names in a PROPFIND (Depth: 1) response, newest first. */
export function parseBackupList(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) throw new Error("The WebDAV server sent a folder listing that is not valid XML");
  const names = Array.from(doc.getElementsByTagNameNS("DAV:", "href"), (href) => {
    const path = (href.textContent ?? "").replace(/\/+$/, "");
    return decodeURIComponent(path.slice(path.lastIndexOf("/") + 1));
  });
  return names.filter((name) => BACKUP_FILE.test(name)).sort().reverse();
}

function folderSegments(folder: string): string[] {
  return folder.split("/").map((part) => part.trim()).filter(Boolean);
}

/** The folder URL with a trailing slash; each folder segment is percent-encoded. */
export function folderUrl(target: Pick<DavTarget, "url" | "folder">, depth?: number): string {
  const segments = folderSegments(target.folder).slice(0, depth).map(encodeURIComponent);
  return [target.url.replace(/\/+$/, ""), ...segments].join("/") + "/";
}

function statusMessage(method: string, status: number): string {
  if (status === 401 || status === 403) return `The WebDAV server rejected the username or password (${status})`;
  if (status === 404) return `The WebDAV address was not found (404)`;
  if (status === 507) return `The WebDAV server is out of space (507)`;
  return `WebDAV ${method} failed with status ${status}`;
}

// The app's web view would block these requests twice: most WebDAV servers
// send no CORS headers, and the page's CSP allows only its own origin. The
// native HTTP plugin runs outside the web view. A browser (the device build
// in desktop Chromium) uses fetch.
async function send(
  method: string,
  url: string,
  target: DavTarget,
  options: { headers?: Record<string, string>; body?: Uint8Array | string; binary?: boolean } = {},
): Promise<DavResponse> {
  const credentials = toBase64(new TextEncoder().encode(`${target.username}:${target.password}`));
  const headers = { Authorization: `Basic ${credentials}`, ...options.headers };

  if (Capacitor.isNativePlatform()) {
    const binaryBody = options.body instanceof Uint8Array;
    const response = await CapacitorHttp.request({
      method,
      url,
      headers,
      data: binaryBody ? toBase64(options.body as Uint8Array) : options.body,
      dataType: binaryBody ? "file" : undefined,
      responseType: options.binary ? "arraybuffer" : "text",
    });
    const data = typeof response.data === "string" ? response.data : "";
    return options.binary
      ? { status: response.status, text: "", bytes: fromBase64(data) }
      : { status: response.status, text: data, bytes: new Uint8Array() };
  }

  // reason: a Uint8Array is a valid fetch body; the DOM lib types only accept
  // ArrayBuffer-backed views, which this always is.
  const response = await fetch(url, { method, headers, body: options.body as BodyInit | undefined });
  return options.binary
    ? { status: response.status, text: "", bytes: new Uint8Array(await response.arrayBuffer()) }
    : { status: response.status, text: await response.text(), bytes: new Uint8Array() };
}

async function expectOk(method: string, url: string, target: DavTarget, options?: Parameters<typeof send>[3]) {
  const response = await send(method, url, target, options);
  if (response.status >= 300) throw new Error(statusMessage(method, response.status));
  return response;
}

async function ensureFolder(target: DavTarget): Promise<void> {
  const depth = folderSegments(target.folder).length;
  for (let level = 1; level <= depth; level++) {
    const { status } = await send("MKCOL", folderUrl(target, level), target);
    // 405: the folder already exists.
    if (status >= 300 && status !== 405) throw new Error(statusMessage("MKCOL", status));
  }
}

const PROPFIND_BODY = '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>';

/** The backup files in the WebDAV folder, newest first. */
export async function listBackups(target: DavTarget): Promise<string[]> {
  const { text } = await expectOk("PROPFIND", folderUrl(target), target, {
    headers: { Depth: "1", "Content-Type": "application/xml; charset=utf-8" },
    body: PROPFIND_BODY,
  });
  return parseBackupList(text);
}

/** Uploads one database file, then deletes all but the newest KEEP_BACKUPS. */
export async function uploadBackup(target: DavTarget, database: Uint8Array, now = new Date()): Promise<void> {
  await ensureFolder(target);
  await expectOk("PUT", folderUrl(target) + backupFileName(now), target, {
    headers: { "Content-Type": "application/octet-stream" },
    body: database,
  });
  for (const name of backupsToDelete(await listBackups(target))) {
    await expectOk("DELETE", folderUrl(target) + encodeURIComponent(name), target);
  }
}

export async function downloadBackup(target: DavTarget, name: string): Promise<Uint8Array> {
  const { bytes } = await expectOk("GET", folderUrl(target) + encodeURIComponent(name), target, { binary: true });
  return bytes;
}
