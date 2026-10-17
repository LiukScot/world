import fs from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";

const fileArg = process.argv.slice(2).find((a) => a.startsWith("--file="));
if (!fileArg) {
  console.error("Usage: bun src/restore-db.ts --file=/absolute/path/to/backup.sqlite");
  process.exit(1);
}

const source = fileArg.slice("--file=".length);
const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), "../data/world.sqlite");

if (!fs.existsSync(source)) {
  console.error(`Backup file not found: ${source}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
if (fs.existsSync(dbPath)) {
  const safetyCopy = `${dbPath}.pre-restore-${Date.now()}.bak`;
  // Snapshot through SQLite like backup-db.ts does, so rows committed to the
  // WAL but not yet checkpointed end up in the safety copy too. A database
  // too damaged to open is exactly the case a restore exists for, so that one
  // still gets a raw copy rather than no copy at all.
  try {
    const current = new Database(dbPath, { readonly: true });
    try {
      fs.writeFileSync(safetyCopy, current.serialize());
    } finally {
      current.close();
    }
  } catch (error) {
    console.error(`Could not snapshot the current database, keeping a raw copy instead: ${error instanceof Error ? error.message : String(error)}`);
    fs.copyFileSync(dbPath, safetyCopy);
  }
  console.log(`Previous database saved to ${safetyCopy}`);
}
fs.copyFileSync(source, dbPath);
// Leftover -wal/-shm files belong to the database that was just replaced;
// SQLite would replay those frames onto the restored file on the next open.
for (const suffix of ["-wal", "-shm"]) {
  fs.rmSync(`${dbPath}${suffix}`, { force: true });
}
console.log(`Restored ${dbPath} from ${source}`);
