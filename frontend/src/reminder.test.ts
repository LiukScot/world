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
    expect(readReminder("diary")).toEqual(DEFAULT_REMINDER);
  });

  test("ignores a stored value with a bad time", () => {
    localStorage.setItem("world.dailyReminder.diary", JSON.stringify({ enabled: true, time: "25:99" }));
    expect(readReminder("diary")).toEqual(DEFAULT_REMINDER);
  });
});

describe("saveReminder", () => {
  test("schedules a daily notification at the chosen time", async () => {
    const result = await saveReminder("diary", { enabled: true, time: "07:30" });
    expect(result).toEqual({ ok: true });
    expect(plugin.schedule.mock.calls[0][0].notifications[0].schedule.on).toEqual({ hour: 7, minute: 30 });
    expect(readReminder("diary")).toEqual({ enabled: true, time: "07:30" });
  });

  test("asks for permission, and saves as off when it is refused", async () => {
    plugin.checkPermissions.mockResolvedValue({ display: "prompt" });
    plugin.requestPermissions.mockResolvedValue({ display: "denied" });
    const result = await saveReminder("diary", { enabled: true, time: "07:30" });
    expect(result).toEqual({ ok: false, reason: "denied" });
    expect(plugin.schedule).not.toHaveBeenCalled();
    expect(readReminder("diary").enabled).toBe(false);
  });

  test("keeps a separate time and notification per page", async () => {
    await saveReminder("diary", { enabled: true, time: "21:00" });
    await saveReminder("pain", { enabled: true, time: "08:15" });
    expect(readReminder("diary").time).toBe("21:00");
    expect(readReminder("pain").time).toBe("08:15");
    const ids = plugin.schedule.mock.calls.map((c) => c[0].notifications[0].id);
    expect(new Set(ids).size).toBe(2);
  });

  test("turning it off cancels the notification", async () => {
    await saveReminder("diary", { enabled: false, time: "07:30" });
    expect(plugin.cancel).toHaveBeenCalled();
    expect(plugin.schedule).not.toHaveBeenCalled();
  });
});
