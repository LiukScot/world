import { beforeEach, describe, expect, test, vi } from "vitest";

const plugin = vi.hoisted(() => ({
  cancel: vi.fn(),
  schedule: vi.fn(),
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
}));

vi.mock("@capacitor/local-notifications", () => ({ LocalNotifications: plugin }));

import { DEFAULT_REMINDER, readReminder, saveReminder } from "./reminder";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  plugin.checkPermissions.mockResolvedValue({ display: "granted" });
});

describe("readReminder", () => {
  test("defaults to off at 20:00", () => {
    expect(readReminder()).toEqual(DEFAULT_REMINDER);
  });

  test("ignores a stored value with a bad time", () => {
    localStorage.setItem("world.dailyReminder", JSON.stringify({ enabled: true, time: "25:99" }));
    expect(readReminder()).toEqual(DEFAULT_REMINDER);
  });
});

describe("saveReminder", () => {
  test("schedules a daily notification at the chosen time", async () => {
    const result = await saveReminder({ enabled: true, time: "07:30" });
    expect(result).toEqual({ ok: true });
    expect(plugin.schedule.mock.calls[0][0].notifications[0].schedule.on).toEqual({ hour: 7, minute: 30 });
    expect(readReminder()).toEqual({ enabled: true, time: "07:30" });
  });

  test("asks for permission, and saves as off when it is refused", async () => {
    plugin.checkPermissions.mockResolvedValue({ display: "prompt" });
    plugin.requestPermissions.mockResolvedValue({ display: "denied" });
    const result = await saveReminder({ enabled: true, time: "07:30" });
    expect(result).toEqual({ ok: false, reason: "denied" });
    expect(plugin.schedule).not.toHaveBeenCalled();
    expect(readReminder().enabled).toBe(false);
  });

  test("turning it off cancels the notification", async () => {
    await saveReminder({ enabled: false, time: "07:30" });
    expect(plugin.cancel).toHaveBeenCalled();
    expect(plugin.schedule).not.toHaveBeenCalled();
  });
});
