import { LocalNotifications } from "@capacitor/local-notifications";
import { z } from "zod";

const STORAGE_KEY = "world.dailyReminder";
const NOTIFICATION_ID = 1;

const reminderSchema = z.object({
  enabled: z.boolean(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export type Reminder = z.infer<typeof reminderSchema>;
export type ReminderResult = { ok: true } | { ok: false; reason: "denied" };

export const DEFAULT_REMINDER: Reminder = { enabled: false, time: "20:00" };

export function readReminder(): Reminder {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = reminderSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    }
  } catch (error) {
    console.warn("Could not read the saved reminder", error);
  }
  return DEFAULT_REMINDER;
}

function persist(reminder: Reminder): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminder));
  } catch (error) {
    console.warn("Could not save the reminder", error);
  }
}

/**
 * Saves the reminder and (re)schedules the daily notification. Turning it on
 * asks iOS for notification permission; when that is refused the reminder is
 * saved as off, so the stored state always matches what iOS will deliver.
 */
export async function saveReminder(next: Reminder): Promise<ReminderResult> {
  if (!next.enabled) {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
  } else {
    let { display } = await LocalNotifications.checkPermissions();
    if (display === "prompt" || display === "prompt-with-rationale") {
      display = (await LocalNotifications.requestPermissions()).display;
    }
    if (display !== "granted") {
      await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
      persist({ ...next, enabled: false });
      return { ok: false, reason: "denied" };
    }
    const [hour, minute] = next.time.split(":").map(Number);
    // Scheduling an existing id replaces it, so a failed call keeps the old
    // reminder, which still matches what is saved. `on` repeats it daily.
    await LocalNotifications.schedule({
      notifications: [{
        id: NOTIFICATION_ID,
        title: "World",
        body: "Add today's entry.",
        schedule: { on: { hour, minute }, allowWhileIdle: true },
      }],
    });
  }
  persist(next);
  return { ok: true };
}
