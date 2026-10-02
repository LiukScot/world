import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { drizzle } from "drizzle-orm/sql-js";
import type { BindParams, Database as SqlJsDatabase } from "sql.js";
import * as schema from "./db/drizzle-schema.ts";
import { users, type DrizzleDB } from "./db/index.ts";
import { runMigrations, type SQLiteDB } from "./db.ts";
import { mountApiRoutes } from "./api.ts";
import type { AppEnv } from "./app-env.ts";

const LOCAL_USER_EMAIL = "local@device";

function toBindParams(params: unknown[]): BindParams {
  // reason: sql.js rejects undefined, which bun:sqlite binds as NULL.
  return params.map((value) => (value === undefined ? null : value)) as BindParams;
}

/**
 * Gives a sql.js database the part of the bun:sqlite API that db.ts and the
 * backup routes call, so both run unchanged.
 *
 * ponytail: every call prepares its statement again. Imports of a few
 * thousand rows are the largest caller; cache statements if that gets slow.
 */
function asBunDatabase(sqlDb: SqlJsDatabase): SQLiteDB {
  const adapter = {
    exec: (sql: string) => {
      sqlDb.exec(sql);
    },
    query: (sql: string) => ({
      run: (...params: unknown[]) => {
        sqlDb.run(sql, toBindParams(params));
        return { changes: sqlDb.getRowsModified() };
      },
      get: (...params: unknown[]) => {
        const statement = sqlDb.prepare(sql);
        try {
          statement.bind(toBindParams(params));
          return statement.step() ? statement.getAsObject() : null;
        } finally {
          statement.free();
        }
      },
      all: (...params: unknown[]) => {
        const statement = sqlDb.prepare(sql);
        try {
          statement.bind(toBindParams(params));
          const rows: unknown[] = [];
          while (statement.step()) rows.push(statement.getAsObject());
          return rows;
        } finally {
          statement.free();
        }
      },
    }),
    transaction:
      <T>(body: () => T) =>
      () => {
        sqlDb.exec("BEGIN");
        try {
          const result = body();
          sqlDb.exec("COMMIT");
          return result;
        } catch (error) {
          sqlDb.exec("ROLLBACK");
          throw error;
        }
      },
  };
  // reason: SQLiteDB is bun's Database class; the adapter implements only the
  // members this codebase calls, which a class type cannot express.
  return adapter as unknown as SQLiteDB;
}

export type LocalApp = {
  fetch(request: Request): Promise<Response>;
  /** The database file as bytes, to be written to storage after a change. */
  exportDatabase(): Uint8Array;
};

/**
 * Builds the API for a device that holds its own data: one sql.js database,
 * one user, no login. `sqlDb` is new or restored from a previous export.
 */
export function createLocalApp(sqlDb: SqlJsDatabase): LocalApp {
  const rawDb = asBunDatabase(sqlDb);
  sqlDb.exec("PRAGMA foreign_keys = ON");
  runMigrations(rawDb);

  // reason: the routes are typed against the bun-sqlite driver; the sql-js
  // driver has the same synchronous query API.
  const db = drizzle(sqlDb, { schema }) as unknown as DrizzleDB;

  const existing = db.select({ id: users.id, email: users.email, name: users.name }).from(users).limit(1).get();
  const user =
    existing ??
    db
      .insert(users)
      .values({ email: LOCAL_USER_EMAIL, passwordHash: "" })
      .returning({ id: users.id, email: users.email, name: users.name })
      .get();

  const app = new Hono<AppEnv>();

  app.use("/api/*", async (c, next) => {
    c.set("db", db);
    c.set("rawDb", rawDb);
    c.set("userId", user.id);
    c.set("userEmail", user.email);
    await next();
  });

  app.get("/api/v1/auth/session", (c) =>
    c.json({ data: { authenticated: true, user: { id: user.id, email: user.email, name: user.name ?? null } } }),
  );

  mountApiRoutes(app);

  app.all("/api/*", (c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404));

  app.onError((err, c) => {
    console.error(`[${err.name}] ${err.message}`);
    if (err instanceof HTTPException) return err.getResponse();
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, 500);
  });

  return {
    fetch: async (request) => app.fetch(request),
    exportDatabase: () => {
      const bytes = sqlDb.export();
      // export() reopens the database, which resets per-connection settings.
      sqlDb.exec("PRAGMA foreign_keys = ON");
      return bytes;
    },
  };
}
