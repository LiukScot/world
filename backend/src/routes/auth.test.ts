import { describe, expect, test, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import authRoute from "./auth.ts";
import { users } from "../db/index.ts";
import {
  createTestApp,
  createTestDb,
  seedUser,
  extractSessionCookie,
  type TestContext,
} from "../test-helpers.ts";

describe("POST /auth/login", () => {
  let ctx: TestContext;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(async () => {
    ctx = createTestDb();
    app = createTestApp(ctx, "/auth", authRoute);
    await seedUser(ctx.db, { email: "user@example.com", password: "Password123!" });
  });

  test("rejects unknown email with 401 INVALID_CREDENTIALS", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com", password: "Password123!" }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });

  test("rejects wrong password with 401 INVALID_CREDENTIALS", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "WrongPassword!" }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });

  test("rejects disabled account with 403 ACCOUNT_DISABLED", async () => {
    await seedUser(ctx.db, {
      email: "disabled@example.com",
      password: "Password123!",
      disabledAt: new Date().toISOString(),
    });
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "disabled@example.com", password: "Password123!" }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("ACCOUNT_DISABLED");
  });

  test("succeeds with correct credentials and sets session cookie", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "Password123!" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.email).toBe("user@example.com");
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toBeTruthy();
    expect(cookie).toContain("WORLD_SESSID=");
    expect(cookie).toContain("HttpOnly");
  });

  test("rejects password longer than 72 chars (PR #82 regression)", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "x".repeat(73) }),
    });
    expect(res.status).toBe(400);
  });

  test("rejects email longer than 254 chars (PR #82 regression)", async () => {
    const longEmail = `${"x".repeat(250)}@e.co`;
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: longEmail, password: "Password123!" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /auth/logout", () => {
  let ctx: TestContext;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(async () => {
    ctx = createTestDb();
    app = createTestApp(ctx, "/auth", authRoute);
    await seedUser(ctx.db, { email: "user@example.com", password: "Password123!" });
  });

  test("clears session cookie even when no session present", async () => {
    const res = await app.request("/auth/logout", { method: "POST" });
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("WORLD_SESSID=");
    expect(cookie).toContain("Max-Age=0");
  });

  test("deletes session row and clears cookie when logged in", async () => {
    const loginRes = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "Password123!" }),
    });
    const sessionCookie = extractSessionCookie(loginRes.headers.get("set-cookie"));

    const res = await app.request("/auth/logout", {
      method: "POST",
      headers: { cookie: sessionCookie },
    });
    expect(res.status).toBe(200);

    const sessionRes = await app.request("/auth/session", {
      headers: { cookie: sessionCookie },
    });
    const body = await sessionRes.json();
    expect(body.data.authenticated).toBe(false);
  });
});

describe("GET /auth/session", () => {
  let ctx: TestContext;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(async () => {
    ctx = createTestDb();
    app = createTestApp(ctx, "/auth", authRoute);
    await seedUser(ctx.db, { email: "user@example.com", password: "Password123!" });
  });

  test("returns authenticated=false without cookie", async () => {
    const res = await app.request("/auth/session");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.authenticated).toBe(false);
  });

  test("returns authenticated=true with valid session cookie", async () => {
    const loginRes = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "Password123!" }),
    });
    const cookie = extractSessionCookie(loginRes.headers.get("set-cookie"));

    const res = await app.request("/auth/session", { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.authenticated).toBe(true);
    expect(body.data.user.email).toBe("user@example.com");
  });
});

describe("POST /auth/register", () => {
  const post = (app: ReturnType<typeof createTestApp>, body: unknown) =>
    app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  test("creates the account and signs it in", async () => {
    const ctx = createTestDb();
    const app = createTestApp(ctx, "/auth", authRoute);

    const res = await post(app, { email: "new@example.com", password: "Password123!", name: "New" });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toEqual({ email: "new@example.com", name: "New" });
    // The response carries a session, so the caller is logged in without
    // posting the same credentials to /login straight after.
    const cookie = extractSessionCookie(res.headers.get("set-cookie"));
    const session = await (await app.request("/auth/session", { headers: { cookie } })).json();
    expect(session.data.authenticated).toBe(true);
    expect(session.data.user.email).toBe("new@example.com");
  });

  test("folds the email so it can be signed into as typed", async () => {
    const ctx = createTestDb();
    const app = createTestApp(ctx, "/auth", authRoute);

    await post(app, { email: "  Mixed@Example.COM ", password: "Password123!" });

    const login = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "MIXED@example.com", password: "Password123!" }),
    });
    expect(login.status).toBe(200);
  });

  test("rejects an email that already has an account with 409", async () => {
    const ctx = createTestDb();
    const app = createTestApp(ctx, "/auth", authRoute);
    await post(app, { email: "taken@example.com", password: "Password123!" });

    const res = await post(app, { email: "Taken@example.com", password: "Different123!" });

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("EMAIL_TAKEN");
  });

  test.each([
    ["a password under 8 characters", { email: "short@example.com", password: "Pass1" }],
    ["a malformed email", { email: "not-an-email", password: "Password123!" }],
    ["no body at all", undefined],
  ])("rejects %s with 400", async (_label, body) => {
    const ctx = createTestDb();
    const app = createTestApp(ctx, "/auth", authRoute);

    const res = body
      ? await post(app, body)
      : await app.request("/auth/register", { method: "POST" });

    expect(res.status).toBe(400);
  });

  /*
   * The hash is awaited between the "is this taken?" check and the insert,
   * so two requests for one address both pass the check and race to the
   * UNIQUE index. Whichever loses must answer the same 409 the check gives,
   * not a 500 about a constraint the caller cannot see.
   */
  test("answers 409, not 500, when two registrations race for one address", async () => {
    const ctx = createTestDb();
    const app = createTestApp(ctx, "/auth", authRoute);
    const body = { email: "race@example.com", password: "Password123!" };

    const statuses = (await Promise.all([post(app, body), post(app, body)]))
      .map((res) => res.status)
      .sort();

    expect(statuses).toEqual([201, 409]);
    const rows = ctx.db.select({ id: users.id }).from(users).where(eq(users.email, "race@example.com")).all();
    expect(rows.length).toBe(1);
  });

  test("does not let a registration claim a name field it was not given", async () => {
    const ctx = createTestDb();
    const app = createTestApp(ctx, "/auth", authRoute);

    const res = await post(app, { email: "noname@example.com", password: "Password123!" });

    expect(res.status).toBe(201);
    expect((await res.json()).data.name).toBeNull();
  });
});

describe("POST /auth/login — bcrypt to argon2id upgrade", () => {
  test("upgrades bcrypt hash to argon2id on successful login", async () => {
    const ctx = createTestDb();
    const app = createTestApp(ctx, "/auth", authRoute);
    const password = "Password123!";

    const bcryptHash = await Bun.password.hash(password, { algorithm: "bcrypt" });
    const inserted = ctx.db
      .insert(users)
      .values({ email: "bcrypt@example.com", passwordHash: bcryptHash })
      .returning({ id: users.id })
      .get();
    if (!inserted) throw new Error("insert failed");

    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bcrypt@example.com", password }),
    });

    expect(res.status).toBe(200);

    const updated = ctx.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, inserted.id))
      .limit(1)
      .get();
    expect(updated?.passwordHash).toBeDefined();
    // argon2id hashes start with $argon2id$
    expect(updated?.passwordHash).toMatch(/^\$argon2id\$/);
  });

  test("argon2id password is not re-hashed on login", async () => {
    const ctx = createTestDb();
    const app = createTestApp(ctx, "/auth", authRoute);
    const password = "Password123!";

    await seedUser(ctx.db, { email: "argon@example.com", password });

    const before = ctx.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, "argon@example.com"))
      .limit(1)
      .get();

    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "argon@example.com", password }),
    });

    expect(res.status).toBe(200);

    const after = ctx.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, "argon@example.com"))
      .limit(1)
      .get();

    expect(after?.passwordHash).toBe(before?.passwordHash);
  });
});

describe("GET /auth/session — deleted user", () => {
  test("returns authenticated=false when user has been deleted from DB", async () => {
    const ctx = createTestDb();
    const app = createTestApp(ctx, "/auth", authRoute);

    await seedUser(ctx.db, { email: "gone@example.com", password: "Password123!" });

    const loginRes = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "gone@example.com", password: "Password123!" }),
    });
    expect(loginRes.status).toBe(200);
    const cookie = extractSessionCookie(loginRes.headers.get("set-cookie"));

    ctx.db.delete(users).where(eq(users.email, "gone@example.com")).run();

    const sessionRes = await app.request("/auth/session", {
      headers: { cookie },
    });
    expect(sessionRes.status).toBe(200);
    const body = await sessionRes.json();
    expect(body.data.authenticated).toBe(false);
  });
});

describe("POST /auth/change-password", () => {
  let ctx: TestContext;
  let app: ReturnType<typeof createTestApp>;
  let cookie: string;

  beforeEach(async () => {
    ctx = createTestDb();
    app = createTestApp(ctx, "/auth", authRoute);
    await seedUser(ctx.db, { email: "user@example.com", password: "Password123!" });
    const loginRes = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "Password123!" }),
    });
    cookie = extractSessionCookie(loginRes.headers.get("set-cookie"));
  });

  test("requires authentication", async () => {
    const res = await app.request("/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "Password123!", newPassword: "NewPassword456!" }),
    });
    expect(res.status).toBe(401);
  });

  test("rejects wrong current password with 400", async () => {
    const res = await app.request("/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ currentPassword: "WrongPassword!", newPassword: "NewPassword456!" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_CURRENT_PASSWORD");
  });

  test("rejects currentPassword longer than 72 chars (argon2id cap regression)", async () => {
    const res = await app.request("/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ currentPassword: "x".repeat(73), newPassword: "NewPassword456!" }),
    });
    expect(res.status).toBe(400);
  });

  test("succeeds and issues new session when current password matches", async () => {
    const res = await app.request("/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ currentPassword: "Password123!", newPassword: "NewPassword456!" }),
    });
    expect(res.status).toBe(200);
    const newCookie = res.headers.get("set-cookie");
    expect(newCookie).toContain("WORLD_SESSID=");

    const loginAgain = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "NewPassword456!" }),
    });
    expect(loginAgain.status).toBe(200);
  });

  test("revokes the user's other sessions, keeps the fresh one", async () => {
    const otherLogin = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "Password123!" }),
    });
    const otherCookie = extractSessionCookie(otherLogin.headers.get("set-cookie"));

    const res = await app.request("/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ currentPassword: "Password123!", newPassword: "NewPassword456!" }),
    });
    expect(res.status).toBe(200);
    const freshCookie = extractSessionCookie(res.headers.get("set-cookie"));

    for (const [name, value, authenticated] of [
      ["other", otherCookie, false],
      ["old", cookie, false],
      ["fresh", freshCookie, true],
    ] as const) {
      const session = await app.request("/auth/session", { headers: { cookie: value } });
      expect((await session.json()).data.authenticated, name).toBe(authenticated);
    }
  });
});

describe("auth rate limit", () => {
  test("blocks the 11th attempt from one address within the window, others unaffected", async () => {
    const ctx = createTestDb();
    const app = createTestApp(ctx, "/auth", authRoute);
    const attempt = (ip: string) =>
      app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ email: "nobody@example.com", password: "WrongPassword!" }),
      });
    for (let i = 0; i < 10; i++) {
      expect((await attempt("203.0.113.7")).status).toBe(401);
    }
    const blocked = await attempt("203.0.113.7");
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error.code).toBe("RATE_LIMITED");
    expect((await attempt("203.0.113.8")).status).toBe(401);
  });

  test("successful sign-ins do not count towards the cap", async () => {
    const ctx = createTestDb();
    const app = createTestApp(ctx, "/auth", authRoute);
    await seedUser(ctx.db, { email: "user@example.com", password: "Password123!" });
    const login = (password: string) =>
      app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.9" },
        body: JSON.stringify({ email: "user@example.com", password }),
      });
    for (let i = 0; i < 12; i++) {
      expect((await login("Password123!")).status).toBe(200);
    }
    expect((await login("WrongPassword!")).status).toBe(401);
  });
});
