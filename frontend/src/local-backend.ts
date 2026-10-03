import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { createLocalApp } from "world-local-backend";
import { setTransport } from "./transport";
import { fromBase64, toBase64 } from "./save-file";

const FILE = "world.sqlite";

type Storage = {
  load(): Promise<Uint8Array | null>;
  save(bytes: Uint8Array): Promise<void>;
};

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

type LocalDatabase = {
  /** The database file as it is now. */
  snapshot(): Uint8Array;
  /**
   * Replaces the whole database with a backup file and reloads the page.
   * Rejects, leaving the current data untouched, if the file is not a World
   * database.
   */
  replace(bytes: Uint8Array): Promise<void>;
};

let localDatabase: LocalDatabase | null = null;

/** The database of the backend running in the page. Device build only. */
export function getLocalDatabase(): LocalDatabase {
  if (!localDatabase) throw new Error("The in-page backend is not running");
  return localDatabase;
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

  // Saves run one at a time, each exporting when its turn comes, so an older
  // copy of the database can never be written after a newer one.
  let lastSave: Promise<void> = Promise.resolve();
  let replaced = false;

  localDatabase = {
    snapshot: () => app.exportDatabase(),
    async replace(bytes) {
      const candidate = new SQL.Database(bytes);
      let migrated: Uint8Array;
      try {
        if (candidate.exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'app_meta'").length === 0) {
          throw new Error("This file is not a World backup");
        }
        // Opening it as an app runs the migrations, which brings an older
        // backup up to this schema.
        const restored = createLocalApp(candidate);
        // The restored data is itself a backup on the server. Recording that
        // keeps the daily backup from running on the reload and overwriting
        // today's file with this older copy.
        await restored.fetch(
          new Request(new URL("/api/v1/webdav-backup/result", location.origin), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ok: true }),
          }),
        );
        migrated = restored.exportDatabase();
      } finally {
        candidate.close();
      }
      replaced = true;
      try {
        await lastSave;
        await storage.save(migrated);
      } catch (error) {
        replaced = false;
        throw error;
      }
      location.reload();
    },
  };

  setTransport(async (path, init) => {
    // A request answered from the old database would save it over the restore.
    if (replaced) throw new Error("The database is being replaced");
    const response = await app.fetch(new Request(new URL(path, location.origin), init));
    const method = (init?.method ?? "GET").toUpperCase();
    if (method !== "GET" && response.ok) {
      const save = lastSave.then(() => storage.save(app.exportDatabase()));
      // The request awaiting `save` reports its failure; the queue goes on.
      lastSave = save.catch(() => undefined);
      await save;
    }
    return response;
  });
}
