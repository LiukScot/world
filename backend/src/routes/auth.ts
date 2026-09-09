import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { users } from "../db/index.ts";
import { parseJson, buildSessionCookie, clearSessionCookie } from "../helpers.ts";
import { loginSchema, registerSchema, changePasswordSchema } from "../schemas.ts";
import { getSession, createSession, deleteSession, deleteUserSessions, requireAuth } from "../middleware/auth.ts";
import { authRateLimit } from "../middleware/rate-limit.ts";
import type { AppEnv as Env } from "../app-env.ts";

async function verifyPassword(password: string, storedHash: string): Promise<{ ok: boolean; rehash?: string }> {
  if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
    const ok = await Bun.password.verify(password, storedHash);
    if (!ok) return { ok: false };
    const rehash = await Bun.password.hash(password, { algorithm: "argon2id" });
    return { ok: true, rehash };
  }
  const ok = await Bun.password.verify(password, storedHash);
  return { ok };
}

function isUniqueEmailViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed:\s*users\.email/i.test(error.message);
}

const auth = new Hono<Env>();

/*
 * Open registration: this instance is not reachable from the internet, so
 * anyone who can hit this endpoint is already on the network. Move it onto a
 * public address and this becomes an open door — gate it before you do.
 *
 * Signing in is part of registering. Making the caller post the same
 * credentials twice buys nothing: the account was just created here, so the
 * verification step would only be checking a password against a hash written
 * one line earlier.
 */
auth.post("/register", authRateLimit, async (c) => {
  const db = c.get("db");
  const body = await parseJson(c, registerSchema);

  // One answer, reached two ways — the lookup below and the constraint that
  // catches what the lookup misses have to agree, so they read from here.
  const emailTaken = () =>
    c.json({ error: { code: "EMAIL_TAKEN", message: "That email already has an account" } }, 409);

  const existing = db.select({ id: users.id }).from(users).where(eq(users.email, body.email)).limit(1).get();
  if (existing) {
    return emailTaken();
  }

  const passwordHash = await Bun.password.hash(body.password, { algorithm: "argon2id" });
  let created;
  try {
    created = db
      .insert(users)
      .values({ email: body.email, passwordHash, name: body.name || null })
      .returning({ id: users.id, email: users.email, name: users.name })
      .get();
  } catch (error) {
    /*
     * Hashing is awaited above, so two requests for one address can both
     * clear the lookup and race to the UNIQUE index. The loser gets the
     * answer the lookup would have given, not a 500 about a constraint the
     * caller cannot see. Anything else is not ours to swallow.
     */
    if (isUniqueEmailViolation(error)) {
      return emailTaken();
    }
    throw error;
  }

  const sid = createSession(db, created.id, created.email);
  c.header("set-cookie", buildSessionCookie(sid));
  return c.json({ data: { email: created.email, name: created.name ?? null } }, 201);
});

auth.post("/login", authRateLimit, async (c) => {
  const db = c.get("db");
  const body = await parseJson(c, loginSchema);
  const user = db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      name: users.name,
      disabledAt: users.disabledAt,
    })
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1)
    .get();

  if (!user) {
    return c.json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" } }, 401);
  }
  if (user.disabledAt) {
    return c.json({ error: { code: "ACCOUNT_DISABLED", message: "Account disabled" } }, 403);
  }

  const check = await verifyPassword(body.password, user.passwordHash);
  if (!check.ok) {
    return c.json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" } }, 401);
  }

  if (check.rehash) {
    db.update(users)
      .set({ passwordHash: check.rehash, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(users.id, user.id))
      .run();
  }

  const sid = createSession(db, user.id, user.email);
  c.header("set-cookie", buildSessionCookie(sid));
  return c.json({ data: { email: user.email, name: user.name ?? null } });
});

auth.post("/logout", (c) => {
  const db = c.get("db");
  const session = getSession(db, c.req.raw);
  if (session) {
    deleteSession(db, session.sid);
  }
  c.header("set-cookie", clearSessionCookie());
  return c.json({ data: { ok: true } });
});

auth.get("/session", (c) => {
  const db = c.get("db");
  const session = getSession(db, c.req.raw);
  if (!session) {
    return c.json({ data: { authenticated: false } });
  }
  const user = db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1)
    .get();
  if (!user) {
    return c.json({ data: { authenticated: false } });
  }
  return c.json({ data: { authenticated: true, user: { id: user.id, email: user.email, name: user.name ?? null } } });
});

auth.post("/change-password", requireAuth, async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const userEmail = c.get("userEmail");
  const body = await parseJson(c, changePasswordSchema);

  const row = db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .get();
  if (!row) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
  }
  const current = await verifyPassword(body.currentPassword, row.passwordHash);
  if (!current.ok) {
    return c.json({ error: { code: "INVALID_CURRENT_PASSWORD", message: "Current password is incorrect" } }, 400);
  }
  const newHash = await Bun.password.hash(body.newPassword, { algorithm: "argon2id" });
  db.update(users)
    .set({ passwordHash: newHash, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(users.id, userId))
    .run();

  // A changed password means the old one may have leaked: every session it
  // opened goes, and only the caller gets a fresh one.
  deleteUserSessions(db, userId);
  const sid = createSession(db, userId, userEmail);
  c.header("set-cookie", buildSessionCookie(sid));
  return c.json({ data: { ok: true } });
});

export default auth;
