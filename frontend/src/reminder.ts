import { LocalNotifications } from "@capacitor/local-notifications";
import { z } from "zod";
import { navLabels, type NavItem } from "./app/core";

/** The pages that carry a reminder, each with its own time and notification. */
export const REMINDER_PAGES = ["diary", "pain", "cbt", "dbt", "money-snapshots"] as const satisfies readonly NavItem[];
export type ReminderPage = (typeof REMINDER_PAGES)[number];

const storageKey = (page: ReminderPage) => `world.dailyReminder.${page}`;
// iOS replaces a pending notification that has the same id, so a page's id
// must stay the same between saves.
const notificationId = (page: ReminderPage) => REMINDER_PAGES.indexOf(page) + 1;

const reminderSchema = z.object({
  enabled: z.boolean(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export type Reminder = z.infer<typeof reminderSchema>;
export type ReminderResult = { ok: true } | { ok: false; reason: "denied" };

export const DEFAULT_REMINDER: Reminder = { enabled: false, time: "20:00" };

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

/**
 * Saves the reminder of one page and (re)schedules the daily notification. Turning it on
 * asks iOS for notification permission; when that is refused the reminder is
 * saved as off, so the stored state always matches what iOS will deliver.
 */
export async function saveReminder(page: ReminderPage, next: Reminder): Promise<ReminderResult> {
  if (!next.enabled) {
    await LocalNotifications.cancel({ notifications: [{ id: notificationId(page) }] });
  } else {
    let { display } = await LocalNotifications.checkPermissions();
    if (display === "prompt" || display === "prompt-with-rationale") {
      display = (await LocalNotifications.requestPermissions()).display;
    }
    if (display !== "granted") {
      await LocalNotifications.cancel({ notifications: [{ id: notificationId(page) }] });
      persist(page, { ...next, enabled: false });
      return { ok: false, reason: "denied" };
    }
    const [hour, minute] = next.time.split(":").map(Number);
    // Scheduling an existing id replaces it, so a failed call keeps the old
    // reminder, which still matches what is saved. `on` repeats it daily.
    await LocalNotifications.schedule({
      notifications: [{
        id: notificationId(page),
        title: navLabels[page],
        body: "Add today's entry.",
        schedule: { on: { hour, minute }, allowWhileIdle: true },
      }],
    });
  }
  persist(page, next);
  return { ok: true };
}
