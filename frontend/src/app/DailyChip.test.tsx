import { beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const plugin = vi.hoisted(() => ({
  cancel: vi.fn(),
  schedule: vi.fn(),
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
}));
vi.mock("@capacitor/local-notifications", () => ({ LocalNotifications: plugin }));

import { readReminder } from "../reminder";
import { DailyChip } from "./DailyChip";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  plugin.checkPermissions.mockResolvedValue({ display: "granted" });
});

const openPanel = async () => {
  render(<DailyChip page="diary" />);
  await userEvent.click(screen.getByRole("button", { name: /reminder is off/i }));
};

describe("DailyChip", () => {
  test("a selected day is pressed and saved", async () => {
    await openPanel();
    await userEvent.click(screen.getByRole("button", { name: "Monday" }));
    expect(screen.getByRole("button", { name: "Monday" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(readReminder("diary").days).toEqual([2]));
  });

  test("the time field stays enabled and keeps its value while a save is pending", async () => {
    let finish = () => {};
    plugin.schedule.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    await openPanel();
    await userEvent.click(screen.getByRole("button", { name: "Monday" }));
    const time = screen.getByLabelText("Time");
    fireEvent.change(time, { target: { value: "07:30" } });
    expect(time).toBeEnabled();
    expect(time).toHaveValue("07:30");
    finish();
    await waitFor(() => expect(readReminder("diary").time).toBe("07:30"));
  });

  test("tapping outside closes the panel", async () => {
    await openPanel();
    expect(screen.getByRole("group", { name: "Reminder days" })).toBeInTheDocument();
    await userEvent.click(document.body);
    expect(screen.queryByRole("group", { name: "Reminder days" })).toBeNull();
  });
});
