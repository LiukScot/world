import { useEffect, useId, useRef, useState } from "react";
import { Switch } from "../components/ui/Switch";
import { getErrorMessage } from "../lib";
import { readReminder, saveReminder, type Reminder, type ReminderPage } from "../reminder";

const REMINDER_DENIED =
  "Notifications are off for World. Turn them on in iOS Settings → World → Notifications, then switch the reminder on again.";

// Lives in the mobile page head, so every page carries it. The panel floats
// under the head instead of pushing the page down.
export function DailyChip({ page }: { page: ReminderPage }) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [reminder, setReminder] = useState<Reminder>(() => readReminder(page));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    // A phone has no Esc key: tapping anywhere else closes the panel.
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const updateReminder = async (next: Reminder) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await saveReminder(page, next);
      if (!result.ok) setMessage(REMINDER_DENIED);
    } catch (error) {
      setMessage(`The reminder could not be saved: ${getErrorMessage(error)}`);
    } finally {
      setReminder(readReminder(page));
      setBusy(false);
    }
  };

  const label = reminder.enabled ? reminder.time : "Reminder";

  return (
    <div ref={rootRef} className="flex-none">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 min-h-[34px] px-3 border-0 rounded-full bg-card-soft text-control font-semibold text-muted cursor-pointer shadow-none hover:text-text focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)]"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={reminder.enabled ? `Daily reminder at ${reminder.time}. Change` : "Daily reminder is off. Set up"}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
        {label}
      </button>
      {open ? (
        <div id={panelId} role="group" aria-label="Daily reminder" className="absolute right-5 top-full mt-2 z-20 grid gap-3 w-[min(320px,calc(100vw-40px))] p-4 bg-card border border-border rounded-md">
          <label className="flex items-center justify-between gap-3 text-control font-semibold text-text">
            Daily reminder
            <Switch
              checked={reminder.enabled}
              disabled={busy}
              onChange={(e) => void updateReminder({ ...reminder, enabled: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-control text-text">
            Time
            <input
              type="time"
              value={reminder.time}
              required
              disabled={busy}
              onChange={(e) => {
                if (e.target.value) void updateReminder({ ...reminder, time: e.target.value });
              }}
            />
          </label>
          {message ? <p role="status" className="m-0 text-hint text-warning leading-normal">{message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
