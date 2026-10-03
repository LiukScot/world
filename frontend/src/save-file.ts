import { Capacitor } from "@capacitor/core";

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  // Firefox and Safari only start fetching the blob once the anchor is in the
  // document, and not before the current task ends — revoking on this tick
  // invalidates the URL and the file downloads empty.
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Hands a file to the user: a download in a browser, the share sheet in the
 * iOS app, where downloads do nothing. Closing the share sheet without
 * choosing a target is not an error.
 */
export async function saveFile(blob: Blob, filename: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    downloadBlob(blob, filename);
    return;
  }
  const [{ Directory, Filesystem }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);
  const data = toBase64(new Uint8Array(await blob.arrayBuffer()));
  const { uri } = await Filesystem.writeFile({ path: filename, directory: Directory.Cache, data });
  try {
    await Share.share({ files: [uri] });
  } catch (error) {
    if (!(error instanceof Error && error.message === "Share canceled")) throw error;
  }
}
