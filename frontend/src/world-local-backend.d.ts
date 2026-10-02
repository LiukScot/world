// The device build aliases this module to backend/src/local-app.ts (see
// vite.config.ts). Declared here so the frontend type check does not follow
// the import into the backend sources, which are checked by their own config.
declare module "world-local-backend" {
  import type { Database } from "sql.js";

  export type LocalApp = {
    fetch(request: Request): Promise<Response>;
    exportDatabase(): Uint8Array;
  };

  export function createLocalApp(sqlDb: Database): LocalApp;
}
