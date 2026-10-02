import type { Hono } from "hono";
import type { AppEnv } from "./app-env.ts";

import diary from "./routes/diary.ts";
import pain from "./routes/pain.ts";
import mood from "./routes/mood.ts";
import preferences from "./routes/preferences.ts";
import memorableDays from "./routes/memorable-days.ts";
import cbt from "./routes/cbt.ts";
import dbt from "./routes/dbt.ts";
import backup from "./routes/backup.ts";
import moneyTransactions from "./routes/money-transactions.ts";
import moneyMovements from "./routes/money-movements.ts";
import moneySnapshots from "./routes/money-snapshots.ts";
import moneyStyles from "./routes/money-styles.ts";
import moneyPrefs from "./routes/money-prefs.ts";
import moneyBackup from "./routes/money-backup.ts";

/**
 * Mounts every data route. Imports nothing from Bun or Node, so it can run
 * inside a WebView as well as on the server. The caller sets `db` and `rawDb`
 * on the context first, and decides how a request is authenticated.
 */
export function mountApiRoutes(app: Hono<AppEnv>): void {
  app.route("/api/v1/diary", diary);
  app.route("/api/v1/pain", pain);
  app.route("/api/v1/mood", mood);
  app.route("/api/v1/cbt", cbt);
  app.route("/api/v1/dbt", dbt);
  app.route("/api/v1/preferences", preferences);
  app.route("/api/v1/memorable-days", memorableDays);
  app.route("/api/v1/backup", backup);
  app.route("/api/v1/data", backup);

  // Money realm. Namespaced because /preferences and /backup would otherwise
  // collide with the health routes above.
  app.route("/api/v1/money/transactions", moneyTransactions);
  app.route("/api/v1/money/monthly-movements", moneyMovements);
  app.route("/api/v1/money/monthly-snapshots", moneySnapshots);
  app.route("/api/v1/money/assets/styles", moneyStyles);
  app.route("/api/v1/money/preferences", moneyPrefs);
  app.route("/api/v1/money/backup", moneyBackup);
  app.route("/api/v1/money/data", moneyBackup);
}
