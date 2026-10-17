import { LocalNotifications } from "@capacitor/local-notifications";
import { z } from "zod";
import { navLabels, type NavItem } from "./app/core";

/** The pages that carry a reminder, each with its own time and notification. */
export const REMINDER_PAGES = ["diary", "pain", "cbt", "dbt", "money-snapshots"] as const satisfies readonly NavItem[];
export type ReminderPage = (typeof REMINDER_PAGES)[number];

const storageKey = (page: ReminderPage) => `world.dailyReminder.${page}`;

/**
 * Weekdays in display order. `day` follows iOS: 1 is Sunday, 7 is Saturday.
 */
export const WEEKDAYS = [
  { day: 2, letter: "M", name: "Monday" },
  { day: 3, letter: "T", name: "Tuesday" },
  { day: 4, letter: "W", name: "Wednesday" },
  { day: 5, letter: "T", name: "Thursday" },
  { day: 6, letter: "F", name: "Friday" },
  { day: 7, letter: "S", name: "Saturday" },
  { day: 1, letter: "S", name: "Sunday" },
] as const;

// iOS replaces a pending notification that has the same id, so the id of a
// page and weekday must stay the same between saves.
const notificationId = (page: ReminderPage, day: number) => (REMINDER_PAGES.indexOf(page) + 1) * 10 + day;

const reminderSchema = z.object({
  days: z.array(z.number().int().min(1).max(7)),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export type Reminder = z.infer<typeof reminderSchema>;
export type ReminderResult = { ok: true } | { ok: false; reason: "denied" };

/** No days means no reminder. */
export const DEFAULT_REMINDER: Reminder = { days: [], time: "20:00" };

export function readReminder(page: ReminderPage): Reminder {
  try {
    const raw = localStorage.getItem(storageKey(page));
    if (raw) {
      const parsed = reminderSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    }
  } catch (error) {
    console.warn("Could not read the saved reminder", error);
  }
  return DEFAULT_REMINDER;
}

function persist(page: ReminderPage, reminder: Reminder): void {
  try {
    localStorage.setItem(storageKey(page), JSON.stringify(reminder));
  } catch (error) {
    console.warn("Could not save the reminder", error);
  }
}

const cancelDays = (page: ReminderPage, days: readonly number[]) =>
  LocalNotifications.cancel({ notifications: days.map((day) => ({ id: notificationId(page, day) })) });

async function apply(page: ReminderPage, next: Reminder): Promise<ReminderResult> {
  const allDays = WEEKDAYS.map((w) => w.day);
  const days = allDays.filter((day) => next.days.includes(day));
  const unselected = allDays.filter((day) => !days.includes(day));
  if (days.length > 0) {
    let { display } = await LocalNotifications.checkPermissions();
    if (display === "prompt" || display === "prompt-with-rationale") {
      display = (await LocalNotifications.requestPermissions()).display;
    }
    if (display !== "granted") {
      await cancelDays(page, allDays);
      persist(page, { ...next, days: [] });
      return { ok: false, reason: "denied" };
    }
    const [hour, minute] = next.time.split(":").map(Number);
    // Schedule before cancelling: scheduling an existing id replaces it, so a
    // failed call leaves the old reminders, which still match what is saved.
    await LocalNotifications.schedule({
      notifications: days.map((weekday) => ({
        id: notificationId(page, weekday),
        title: navLabels[page],
        body: "Add today's entry.",
        schedule: { on: { weekday, hour, minute }, allowWhileIdle: true },
      })),
    });
  }
  await cancelDays(page, unselected);
  persist(page, { ...next, days });
  return { ok: true };
}

// Taps arrive faster than iOS answers; saves run one after another so the
// last tap is the one that stays.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Saves the reminder of one page and (re)schedules one weekly notification per
 * selected weekday. Selecting the first day asks iOS for notification
 * permission; when that is refused the reminder is saved with no days, so the
 * stored state always matches what iOS will deliver.
 */
export function saveReminder(page: ReminderPage, next: Reminder): Promise<ReminderResult> {
  const run = queue.then(() => apply(page, next));
  // The caller gets the rejection through `run`; the chain only has to go on.
  queue = run.then(() => undefined, () => undefined);
  return run;
}
