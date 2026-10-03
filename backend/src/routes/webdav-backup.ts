import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { webdavBackup } from "../db/index.ts";
import { parseJson } from "../helpers.ts";
import { webdavResultSchema, webdavSettingsSchema } from "../schemas.ts";
import type { AppEnv as Env } from "../app-env.ts";

// Device app only: the server has no WebDAV backup, so local-app.ts mounts
// this and api.ts does not. The password is never sent here.
const webdavBackupRoutes = new Hono<Env>();

webdavBackupRoutes.get("/", (c) => {
  const row = c.get("db")
    .select({
      url: webdavBackup.url,
      folder: webdavBackup.folder,
      username: webdavBackup.username,
      enabled: webdavBackup.enabled,
      lastAttemptAt: webdavBackup.lastAttemptAt,
      lastSuccessAt: webdavBackup.lastSuccessAt,
      lastError: webdavBackup.lastError,
    })
    .from(webdavBackup)
    .where(eq(webdavBackup.userId, c.get("userId")))
    .get();

  return c.json({
    data: row
      ? { ...row, enabled: row.enabled === 1 }
      : { url: "", folder: "", username: "", enabled: false, lastAttemptAt: null, lastSuccessAt: null, lastError: null },
  });
});

webdavBackupRoutes.put("/", async (c) => {
  const body = await parseJson(c, webdavSettingsSchema);
  const values = { url: body.url, folder: body.folder, username: body.username, enabled: body.enabled ? 1 : 0 };
  c.get("db")
    .insert(webdavBackup)
    .values({ userId: c.get("userId"), ...values })
    .onConflictDoUpdate({ target: webdavBackup.userId, set: { ...values, updatedAt: sql`CURRENT_TIMESTAMP` } })
    .run();
  return c.json({ data: { ok: true } });
});

/** Records the outcome of one backup attempt. */
webdavBackupRoutes.post("/result", async (c) => {
  const body = await parseJson(c, webdavResultSchema);
  const now = new Date().toISOString();
  const outcome = body.ok
    ? { lastAttemptAt: now, lastSuccessAt: now, lastError: null }
    : { lastAttemptAt: now, lastError: body.error ?? "Backup failed" };
  c.get("db")
    .insert(webdavBackup)
    .values({ userId: c.get("userId"), ...outcome })
    .onConflictDoUpdate({ target: webdavBackup.userId, set: outcome })
    .run();
  return c.json({ data: { ok: true } });
});

export default webdavBackupRoutes;
