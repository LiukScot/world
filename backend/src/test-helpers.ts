import { Database } from "bun:sqlite";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { users, type DrizzleDB } from "./db/index.ts";
import { createDrizzle } from "./open-db.ts";
import { runMigrations, type SQLiteDB } from "./db.ts";
import type { AppEnv } from "./app-env.ts";

export type TestContext = {
  db: DrizzleDB;
  rawDb: SQLiteDB;
};

export function createTestDb(): TestContext {
  const rawDb = new Database(":memory:");
  rawDb.query("PRAGMA journal_mode = MEMORY").run();
  rawDb.query("PRAGMA foreign_keys = ON").run();
  runMigrations(rawDb);
  return { rawDb, db: createDrizzle(rawDb) };
}

export type SeededUser = {
  id: number;
  email: string;
};

let seedUserCounter = 0;

export async function seedUser(db: DrizzleDB, opts: { email?: string } = {}): Promise<SeededUser> {
  const email = opts.email ?? `test-${++seedUserCounter}@example.com`;
  const inserted = db.insert(users).values({ email, passwordHash: "" }).returning({ id: users.id }).get();
  if (!inserted) {
    throw new Error("seedUser: failed to insert user");
  }
  return { id: inserted.id, email };
}

export type TestEnv = AppEnv;

/*
 * Stands in for the host that puts the user on the context. The app sets its
 * one local user on every request; a test names the user per request through
 * this cookie, so one test can act as two users and check they stay apart.
 */
function userIdFromRequest(req: Request): number | undefined {
  const match = req.headers.get("cookie")?.match(/(?:^|;\s*)test_user=(\d+)/);
  return match ? Number(match[1]) : undefined;
}

export function createMultiRouteApp(
  ctx: TestContext,
  mounts: Array<{ path: string; route: Hono<TestEnv> }>
): Hono<TestEnv> {
  const app = new Hono<TestEnv>();
  app.use("*", async (c, next) => {
    c.set("db", ctx.db);
    c.set("rawDb", ctx.rawDb);
    const userId = userIdFromRequest(c.req.raw);
    if (userId !== undefined) c.set("userId", userId);
    await next();
  });
  for (const { path, route } of mounts) {
    app.route(path, route);
  }
  return app;
}

export type AuthedAppSetup = {
  ctx: TestContext;
  app: Hono<TestEnv>;
  cookie: string;
  user: SeededUser;
};

export async function setupAuthedApp(
  mounts: Array<{ path: string; route: Hono<TestEnv> }>,
  opts: { email?: string } = {}
): Promise<AuthedAppSetup> {
  const ctx = createTestDb();
  const app = createMultiRouteApp(ctx, mounts);
  const user = await seedUser(ctx.db, opts);
  return { ctx, app, cookie: sessionCookieFor(ctx.db, user.email), user };
}

/** The cookie that makes a test request act as an existing user. */
export function sessionCookieFor(db: DrizzleDB, email: string): string {
  const user = db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
  if (!user) throw new Error(`sessionCookieFor: no user ${email}`);
  return `test_user=${user.id}`;
}
