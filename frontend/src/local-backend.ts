import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { createLocalApp } from "world-local-backend";
import { setTransport } from "./transport";

const FILE = "world.sqlite";

type Storage = {
  load(): Promise<Uint8Array | null>;
  save(bytes: Uint8Array): Promise<void>;
};

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// A file in Library/ is part of the device backup and is not subject to the
// storage eviction WebKit applies to IndexedDB.
const fileStorage: Storage = {
  async load() {
    const location = { path: FILE, directory: Directory.Library };
    const { files } = await Filesystem.readdir({ path: "", directory: Directory.Library });
    if (!files.some((file) => file.name === FILE)) return null;
    const { data } = await Filesystem.readFile(location);
    if (typeof data !== "string") throw new Error("The database file was not returned as text");
    return fromBase64(data);
  },
  async save(bytes) {
    await Filesystem.writeFile({ path: FILE, directory: Directory.Library, data: toBase64(bytes) });
  },
};

const STORE = "database";

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function browserStorage(): Promise<Storage> {
  const open = indexedDB.open("world", 1);
  open.onupgradeneeded = () => open.result.createObjectStore(STORE);
  const store = await settle(open);
  return {
    async load() {
      const saved: unknown = await settle(store.transaction(STORE).objectStore(STORE).get(FILE));
      return saved instanceof Uint8Array ? saved : null;
    },
    async save(bytes) {
      await settle(store.transaction(STORE, "readwrite").objectStore(STORE).put(bytes, FILE));
    },
  };
}

/**
 * Starts the backend inside the page and routes API requests to it. The
 * database is restored from storage, and written back after every request
 * that changes it, before that request is answered.
 */
export async function startLocalBackend(): Promise<void> {
  const storage = Capacitor.isNativePlatform() ? fileStorage : await browserStorage();
  const [SQL, saved] = await Promise.all([initSqlJs({ locateFile: () => wasmUrl }), storage.load()]);
  const app = createLocalApp(saved ? new SQL.Database(saved) : new SQL.Database());

  setTransport(async (path, init) => {
    const response = await app.fetch(new Request(new URL(path, location.origin), init));
    const method = (init?.method ?? "GET").toUpperCase();
    if (method !== "GET" && response.ok) {
      await storage.save(app.exportDatabase());
    }
    return response;
  });
}
