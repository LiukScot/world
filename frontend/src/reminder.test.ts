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

const MON = 2;
const WED = 4;
const SUN = 1;
const scheduled = () => plugin.schedule.mock.calls.flatMap((c) => c[0].notifications);

describe("readReminder", () => {
  test("defaults to no days at 20:00", () => {
    expect(readReminder("diary")).toEqual(DEFAULT_REMINDER);
  });

  test("ignores a stored value with a bad time", () => {
    localStorage.setItem("world.dailyReminder.diary", JSON.stringify({ days: [MON], time: "25:99" }));
    expect(readReminder("diary")).toEqual(DEFAULT_REMINDER);
  });
});

describe("saveReminder", () => {
  test("schedules one weekly notification per selected day at the chosen time", async () => {
    const result = await saveReminder("diary", { days: [MON, WED], time: "07:30" });
    expect(result).toEqual({ ok: true });
    expect(scheduled().map((n) => n.schedule.on)).toEqual([
      { weekday: MON, hour: 7, minute: 30 },
      { weekday: WED, hour: 7, minute: 30 },
    ]);
    expect(readReminder("diary")).toEqual({ days: [MON, WED], time: "07:30" });
  });

  test("cancels the days that are no longer selected", async () => {
    await saveReminder("diary", { days: [MON], time: "07:30" });
    const cancelled = plugin.cancel.mock.calls.at(-1)?.[0].notifications.map((n: { id: number }) => n.id);
    expect(cancelled).toHaveLength(6);
    expect(cancelled).not.toContain(scheduled()[0].id);
  });

  test("asks for permission, and saves with no days when it is refused", async () => {
    plugin.checkPermissions.mockResolvedValue({ display: "prompt" });
    plugin.requestPermissions.mockResolvedValue({ display: "denied" });
    const result = await saveReminder("diary", { days: [SUN], time: "07:30" });
    expect(result).toEqual({ ok: false, reason: "denied" });
    expect(plugin.schedule).not.toHaveBeenCalled();
    expect(readReminder("diary").days).toEqual([]);
  });

  test("keeps a separate time and notification ids per page", async () => {
    await saveReminder("diary", { days: [MON], time: "21:00" });
    await saveReminder("pain", { days: [MON], time: "08:15" });
    expect(readReminder("diary").time).toBe("21:00");
    expect(readReminder("pain").time).toBe("08:15");
    expect(new Set(scheduled().map((n) => n.id)).size).toBe(2);
  });

  test("with no days nothing is scheduled and everything is cancelled", async () => {
    await saveReminder("diary", { days: [], time: "07:30" });
    expect(plugin.schedule).not.toHaveBeenCalled();
    expect(plugin.cancel.mock.calls.at(-1)?.[0].notifications).toHaveLength(7);
  });

  test("overlapping saves run in order, so the last one wins", async () => {
    await Promise.all([
      saveReminder("diary", { days: [MON], time: "07:00" }),
      saveReminder("diary", { days: [WED], time: "08:00" }),
    ]);
    expect(readReminder("diary")).toEqual({ days: [WED], time: "08:00" });
  });
});
