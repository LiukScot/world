import { Capacitor } from "@capacitor/core";
import { fromBase64 } from "./save-file";

// Where the iOS app copies PDFs sent to it from another app's share sheet,
// and the event it fires when the page is already running. Must match
// SceneDelegate.swift.
const INBOX = "shared-pdf";
export const SHARED_PDF_EVENT = "world:shared-pdf";

// Launch, foreground and the native event can all ask at once; the second
// reader would find the files already deleted.
let reading: Promise<File[]> | null = null;

async function readInbox(): Promise<File[]> {
  const { Directory, Filesystem } = await import("@capacitor/filesystem");
  const location = { path: INBOX, directory: Directory.Cache };
  let names: string[];
  try {
    names = (await Filesystem.readdir(location)).files.map((file) => file.name);
  } catch {
    // The folder only exists once something has been shared to the app.
    return [];
  }
  const files: File[] = [];
  for (const name of names.filter((entry) => /\.pdf$/i.test(entry))) {
    const path = `${INBOX}/${name}`;
    const { data } = await Filesystem.readFile({ path, directory: Directory.Cache });
    await Filesystem.deleteFile({ path, directory: Directory.Cache });
    if (typeof data === "string") files.push(new File([new Uint8Array(fromBase64(data))], name, { type: "application/pdf" }));
  }
  return files;
}

/**
 * Takes the PDFs that the share sheet left in the app's inbox, removing them
 * from it. Empty outside the iOS app.
 */
export function takeSharedPdfs(): Promise<File[]> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve([]);
  reading ??= readInbox().finally(() => {
    reading = null;
  });
  return reading;
}
