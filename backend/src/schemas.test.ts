import { describe, expect, test } from "bun:test";
import {
  loginSchema,
  changePasswordSchema,
  diarySchema,
  painSchema,
  cbtSchema,
  dbtSchema,
  prefsSchema,
  memorableDaySchema,
  backupImportSchema,
  optionFieldSchema,
} from "./schemas.ts";

describe("loginSchema", () => {
  test("accepts valid email + password", () => {
    const r = loginSchema.safeParse({ email: "a@b.co", password: "Password123!" });
    expect(r.success).toBe(true);
  });

  test("rejects non-email format", () => {
    const r = loginSchema.safeParse({ email: "not-an-email", password: "Password123!" });
    expect(r.success).toBe(false);
  });

  test("rejects email longer than 254 chars (PR #82 cap)", () => {
    const r = loginSchema.safeParse({ email: `${"x".repeat(250)}@e.co`, password: "Password123!" });
    expect(r.success).toBe(false);
  });

  test("rejects empty password", () => {
    const r = loginSchema.safeParse({ email: "a@b.co", password: "" });
    expect(r.success).toBe(false);
  });

  test("rejects password longer than 72 chars (argon2id cap)", () => {
    const r = loginSchema.safeParse({ email: "a@b.co", password: "x".repeat(73) });
    expect(r.success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  test("accepts new password with 8 chars min", () => {
    const r = changePasswordSchema.safeParse({ currentPassword: "old", newPassword: "12345678" });
    expect(r.success).toBe(true);
  });

  test("rejects new password shorter than 8 chars", () => {
    const r = changePasswordSchema.safeParse({ currentPassword: "old", newPassword: "1234567" });
    expect(r.success).toBe(false);
  });

  test("rejects new password longer than 72 chars", () => {
    const r = changePasswordSchema.safeParse({ currentPassword: "old", newPassword: "x".repeat(73) });
    expect(r.success).toBe(false);
  });

  test("rejects currentPassword longer than 72 chars (argon2id cap regression)", () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: "x".repeat(73),
      newPassword: "ValidNewPass1!",
    });
    expect(r.success).toBe(false);
  });
});

describe("diarySchema", () => {
  test("accepts minimal valid payload", () => {
    const r = diarySchema.safeParse({ entryDate: "2026-05-16", entryTime: "10:00" });
    expect(r.success).toBe(true);
  });

  test("rejects moodLevel < 1", () => {
    const r = diarySchema.safeParse({
      entryDate: "2026-05-16",
      entryTime: "10:00",
      moodLevel: 0,
    });
    expect(r.success).toBe(false);
  });

  test("rejects moodLevel > 9", () => {
    const r = diarySchema.safeParse({
      entryDate: "2026-05-16",
      entryTime: "10:00",
      moodLevel: 10,
    });
    expect(r.success).toBe(false);
  });

  test("accepts null moodLevel", () => {
    const r = diarySchema.safeParse({
      entryDate: "2026-05-16",
      entryTime: "10:00",
      moodLevel: null,
    });
    expect(r.success).toBe(true);
  });

  test("rejects empty entryDate", () => {
    const r = diarySchema.safeParse({ entryDate: "", entryTime: "10:00" });
    expect(r.success).toBe(false);
  });

  test.each([
    ["a day the month does not have", "2026-02-30", "10:00"],
    ["a month past December", "2026-13-01", "10:00"],
    ["an hour past 23", "2026-05-16", "24:00"],
    ["a minute past 59", "2026-05-16", "10:60"],
  ])("rejects %s", (_name, entryDate, entryTime) => {
    expect(diarySchema.safeParse({ entryDate, entryTime }).success).toBe(false);
  });
});

describe("painSchema", () => {
  test("accepts valid payload with arrays", () => {
    const r = painSchema.safeParse({
      entryDate: "2026-05-16",
      entryTime: "10:00",
      painLevel: 5,
      area: ["back", "neck"],
    });
    expect(r.success).toBe(true);
  });

  test("rejects painLevel > 9", () => {
    const r = painSchema.safeParse({
      entryDate: "2026-05-16",
      entryTime: "10:00",
      painLevel: 10,
    });
    expect(r.success).toBe(false);
  });

  test("rejects coffeeCount > 50", () => {
    const r = painSchema.safeParse({
      entryDate: "2026-05-16",
      entryTime: "10:00",
      coffeeCount: 51,
    });
    expect(r.success).toBe(false);
  });
});

describe("cbtSchema", () => {
  test("accepts valid payload", () => {
    const r = cbtSchema.safeParse({ entryDate: "2026-05-16", entryTime: "10:00" });
    expect(r.success).toBe(true);
  });

  test("defaults optional string fields to empty", () => {
    const r = cbtSchema.parse({ entryDate: "2026-05-16", entryTime: "10:00" });
    expect(r.situation).toBe("");
    expect(r.thoughts).toBe("");
  });
});

describe("dbtSchema", () => {
  test("accepts valid payload", () => {
    const r = dbtSchema.safeParse({ entryDate: "2026-05-16", entryTime: "10:00" });
    expect(r.success).toBe(true);
  });
});

describe("prefsSchema", () => {
  test("accepts a valid payload", () => {
    const r = prefsSchema.safeParse({
      model: "x",
      chatRange: "all",
      lastRange: "all",
      graphSelection: {},
    });
    expect(r.success).toBe(true);
  });

  test("applies defaults for an empty payload", () => {
    const r = prefsSchema.parse({});
    expect(r.chatRange).toBe("all");
    expect(r.graphSelection).toEqual({});
  });

  test("rejects a model longer than 200 chars", () => {
    const r = prefsSchema.safeParse({ model: "x".repeat(201) });
    expect(r.success).toBe(false);
  });
});

describe("memorableDaySchema", () => {
  test("accepts a minimal event", () => {
    const r = memorableDaySchema.safeParse({
      date: "2026-08-15",
      title: "Trip",
    });
    expect(r.success).toBe(true);
  });

  test("rejects empty title after trim", () => {
    const r = memorableDaySchema.safeParse({
      date: "2026-08-15",
      title: "   ",
    });
    expect(r.success).toBe(false);
  });

  test("rejects title longer than 120 chars", () => {
    const r = memorableDaySchema.safeParse({
      date: "2026-08-15",
      title: "x".repeat(121),
    });
    expect(r.success).toBe(false);
  });

  test("rejects nonexistent calendar date", () => {
    const r = memorableDaySchema.safeParse({
      date: "2026-02-30",
      title: "Trip",
    });
    expect(r.success).toBe(false);
  });

  test("rejects emoji longer than 16 chars", () => {
    const r = memorableDaySchema.safeParse({
      date: "2026-08-15",
      title: "Trip",
      emoji: "x".repeat(17),
    });
    expect(r.success).toBe(false);
  });
});

describe("backupImportSchema", () => {
  test("accepts empty body", () => {
    const r = backupImportSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  test("accepts diary + pain rows", () => {
    const r = backupImportSchema.safeParse({
      diary: { rows: [{ date: "2026-01-01" }] },
      pain: { rows: [{ date: "2026-01-01" }] },
    });
    expect(r.success).toBe(true);
  });
});

describe("optionFieldSchema", () => {
  test("accepts valid field + value", () => {
    const r = optionFieldSchema.safeParse({ field: "area", value: "back" });
    expect(r.success).toBe(true);
  });

  test("rejects empty value", () => {
    const r = optionFieldSchema.safeParse({ field: "area", value: "" });
    expect(r.success).toBe(false);
  });
});
