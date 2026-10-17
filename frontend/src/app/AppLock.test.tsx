import { beforeEach, describe, expect, test, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

const lock = vi.hoisted(() => ({
  authenticate: vi.fn(),
  enabled: true,
  handler: null as null | ((state: { isActive: boolean }) => void),
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn(async (_event: string, handler: (state: { isActive: boolean }) => void) => {
      lock.handler = handler;
      return { remove: vi.fn() };
    }),
  },
}));
vi.mock("../app-lock", () => ({
  authenticate: lock.authenticate,
  readLockEnabled: () => lock.enabled,
}));

import { AppLock } from "./AppLock";

const renderLock = async () => {
  render(<AppLock><p>secret entry</p></AppLock>);
  await act(async () => {});
};

beforeEach(() => {
  vi.clearAllMocks();
  lock.enabled = true;
  lock.authenticate.mockResolvedValue({ ok: true });
});

describe("AppLock", () => {
  test("asks for Face ID at startup and opens on success", async () => {
    await renderLock();
    expect(lock.authenticate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("stays locked after a failed startup check", async () => {
    lock.authenticate.mockResolvedValue({ ok: false, reason: "failed" });
    await renderLock();
    expect(screen.getByRole("dialog", { name: "World is locked" })).toBeTruthy();
  });

  test("locks when the app leaves the foreground and asks again on return", async () => {
    await renderLock();
    lock.authenticate.mockClear();
    await act(async () => lock.handler?.({ isActive: false }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => lock.handler?.({ isActive: true }));
    expect(lock.authenticate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("does not ask again after a cancelled prompt when the app becomes active", async () => {
    await renderLock();
    await act(async () => lock.handler?.({ isActive: false }));
    lock.authenticate.mockClear();
    lock.authenticate.mockResolvedValue({ ok: false, reason: "failed" });
    await act(async () => lock.handler?.({ isActive: true }));
    await act(async () => lock.handler?.({ isActive: false }));
    await act(async () => lock.handler?.({ isActive: true }));
    expect(lock.authenticate).toHaveBeenCalledTimes(1);
  });

  test("never locks while the setting is off", async () => {
    lock.enabled = false;
    await renderLock();
    await act(async () => lock.handler?.({ isActive: false }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(lock.authenticate).not.toHaveBeenCalled();
  });
});
