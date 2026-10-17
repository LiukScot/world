import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const auth = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock("../app-lock", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app-lock")>()),
  authenticate: auth.authenticate,
}));

import { readLockEnabled } from "../app-lock";
import { LockSettings } from "./LockSettings";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("LockSettings", () => {
  test("turns the lock on after Face ID succeeds", async () => {
    auth.authenticate.mockResolvedValue({ ok: true });
    render(<LockSettings />);
    await userEvent.click(screen.getByRole("switch", { name: /lock with face id/i }));
    await waitFor(() => expect(readLockEnabled()).toBe(true));
  });

  test("keeps the lock off and explains why when Face ID is unavailable", async () => {
    auth.authenticate.mockResolvedValue({ ok: false, reason: "unavailable" });
    render(<LockSettings />);
    await userEvent.click(screen.getByRole("switch", { name: /lock with face id/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/not available/i);
    expect(readLockEnabled()).toBe(false);
  });
});
