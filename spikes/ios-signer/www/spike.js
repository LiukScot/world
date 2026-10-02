const FILE = "world-spike.sqlite";
const logEl = document.getElementById("log");
const rowsEl = document.getElementById("rows");

// There is no debugger on the phone, so everything is printed on the page.
function log(message) {
  logEl.textContent = `${new Date().toISOString().slice(11, 23)} ${message}\n${logEl.textContent}`;
}

function toBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// In a desktop browser there is no native bridge; localStorage stands in so
// the SQLite half of the spike can be checked before building an IPA.
function createStorage() {
  const native = window.Capacitor?.isNativePlatform?.();
  if (!native) {
    return {
      name: "localStorage (browser)",
      read: async () => localStorage.getItem(FILE),
      write: async (data) => localStorage.setItem(FILE, data),
      remove: async () => localStorage.removeItem(FILE),
    };
  }
  const call = (method, options) => window.Capacitor.nativePromise("Filesystem", method, options);
  const target = { path: FILE, directory: "LIBRARY" };
  return {
    name: "Filesystem plugin, Library/",
    read: async () => {
      try {
        return (await call("readFile", target)).data;
      } catch (error) {
        log(`no file yet (${error?.message ?? error})`);
        return null;
      }
    },
    write: (data) => call("writeFile", { ...target, data }),
    remove: () => call("deleteFile", target),
  };
}

async function main() {
  const storage = createStorage();
  log(`storage: ${storage.name}`);

  const SQL = await initSqlJs();
  const saved = await storage.read();
  const db = saved ? new SQL.Database(fromBase64(saved)) : new SQL.Database();
  db.run("CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, note TEXT NOT NULL)");
  log(saved ? `loaded ${fromBase64(saved).length} bytes from the file` : "started with an empty database");

  const refresh = () => {
    rowsEl.textContent = String(db.exec("SELECT count(*) FROM entries")[0].values[0][0]);
  };

  async function save() {
    const exportStart = performance.now();
    const bytes = db.export();
    const exportMs = performance.now() - exportStart;
    const writeStart = performance.now();
    await storage.write(toBase64(bytes));
    const writeMs = performance.now() - writeStart;
    log(`saved ${bytes.length} bytes: export ${exportMs.toFixed(1)} ms, write ${writeMs.toFixed(1)} ms`);
  }

  async function add(count) {
    db.run("BEGIN");
    const insert = db.prepare("INSERT INTO entries (created_at, note) VALUES (?, ?)");
    for (let i = 0; i < count; i++) {
      insert.run([new Date().toISOString(), "a diary entry of ordinary length, written to fill the database"]);
    }
    insert.free();
    db.run("COMMIT");
    await save();
    refresh();
  }

  const guarded = (action) => () => action().catch((error) => log(`ERROR ${error?.message ?? error}`));
  document.getElementById("add").addEventListener("click", guarded(() => add(1)));
  document.getElementById("bulk").addEventListener("click", guarded(() => add(20000)));
  document.getElementById("reset").addEventListener("click", guarded(async () => {
    await storage.remove();
    log("file deleted; reopen the app to start empty");
  }));

  refresh();
}

main().catch((error) => log(`ERROR ${error?.message ?? error}`));
