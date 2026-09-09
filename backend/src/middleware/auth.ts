import { createMiddleware } from "hono/factory";
import { eq, and, gt, isNull, sql } from "drizzle-orm";
import { env } from "../env.ts";
import { readCookie } from "../helpers.ts";
import type { DrizzleDB } from "../db/index.ts";
import { sessions, users } from "../db/index.ts";
import type { SQLiteDB } from "../db.ts";
import type { AppEnv } from "../app-env.ts";

export type SessionData = {
  sid: string;
  userId: number;
  email: string;
};

export function getSession(db: DrizzleDB, req: Request): SessionData | null {
  const sid = readCookie(req, env.SESSION_COOKIE_NAME);
  if (!sid) return null;
  const row = db
    .select({ sid: sessions.sid, userId: sessions.userId, email: sessions.email })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(
      eq(sessions.sid, sid),
      gt(sessions.expiresAt, sql`datetime('now')`),
      isNull(users.disabledAt),
    ))
    .limit(1)
    .get();
  if (!row) return null;
  return { sid: row.sid, userId: row.userId, email: row.email };
}

export function createSession(db: DrizzleDB, userId: number, email: string): string {
  const sid = crypto.randomUUID().replaceAll("-", "");
  const ttlSeconds = env.SESSION_TTL_SECONDS;
  db.insert(sessions).values({
    sid,
    userId,
    email,
    expiresAt: sql`datetime('now', '+' || ${ttlSeconds} || ' seconds')`,
  }).run();
  return sid;
}

export function deleteSession(db: DrizzleDB, sid: string): void {
  db.delete(sessions).where(eq(sessions.sid, sid)).run();
}

/** Signs the user out everywhere — the step a password change exists for. */
export function deleteUserSessions(db: DrizzleDB, userId: number): void {
  db.delete(sessions).where(eq(sessions.userId, userId)).run();
}

/** Remove expired sessions — call on startup */
export function cleanupExpiredSessions(rawDb: SQLiteDB): void {
  rawDb.query(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
}

/**
 * Middleware that requires authentication.
 * Sets userId and userEmail on the context for use in route handlers.
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const db = c.get("db");
  const session = getSession(db, c.req.raw);
  if (!session) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
  }

  c.set("userId", session.userId);
  c.set("userEmail", session.email);
  c.set("sessionSid", session.sid);
  await next();
});
