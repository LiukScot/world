import { beforeEach, describe, expect, test, vi } from "vitest";

const bio = vi.hoisted(() => ({ isAvailable: vi.fn(), verifyIdentity: vi.fn() }));
vi.mock("@capgo/capacitor-native-biometric", () => ({ NativeBiometric: bio }));

import { authenticate, readLockEnabled, saveLockEnabled } from "./app-lock";

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.clearAllMocks();
});

describe("lock setting", () => {
  test("is off by default and round-trips", () => {
    expect(readLockEnabled()).toBe(false);
    saveLockEnabled(true);
    expect(readLockEnabled()).toBe(true);
    saveLockEnabled(false);
    expect(readLockEnabled()).toBe(false);
  });
});

describe("authenticate", () => {
  test("passes when Face ID succeeds", async () => {
    bio.isAvailable.mockResolvedValue({ isAvailable: true });
    bio.verifyIdentity.mockResolvedValue(undefined);
    expect(await authenticate()).toEqual({ ok: true });
  });

  test("reports unavailable when the device cannot authenticate", async () => {
    bio.isAvailable.mockResolvedValue({ isAvailable: false });
    expect(await authenticate()).toEqual({ ok: false, reason: "unavailable" });
  });

  test("reports failed when the check is rejected", async () => {
    bio.isAvailable.mockResolvedValue({ isAvailable: true });
    bio.verifyIdentity.mockRejectedValue(new Error("cancelled"));
    expect(await authenticate()).toEqual({ ok: false, reason: "failed" });
  });
});
