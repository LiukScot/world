import { useState } from "react";
import { authenticate, readLockEnabled, readLockOnResume, saveLockEnabled, saveLockOnResume } from "../app-lock";
import { getErrorMessage } from "../lib";
import { Switch } from "../components/ui/Switch";
import { SectionHead } from "./shared";

const UNAVAILABLE = "Face ID is not available. Set up Face ID or a passcode in iOS Settings, then try again.";
const FAILED = "Face ID did not match, so the lock stays off. Try again.";

export function LockSettings() {
  const [enabled, setEnabled] = useState(readLockEnabled);
  const [onResume, setOnResume] = useState(readLockOnResume);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const toggle = async (on: boolean) => {
    setBusy(true);
    setMessage(null);
    try {
      // Prove Face ID works before turning the lock on, so it cannot lock you out.
      if (on) {
        const result = await authenticate();
        if (!result.ok) {
          setMessage(result.reason === "unavailable" ? UNAVAILABLE : FAILED);
          return;
        }
      }
      saveLockEnabled(on);
      setEnabled(on);
    } catch (error) {
      setMessage(`Face ID could not be checked: ${getErrorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3">
      <SectionHead title="App lock" variant="accent" />
      <label className="flex items-center justify-between gap-3 p-3 bg-card-soft rounded-md text-control font-semibold text-text">
        Lock with Face ID
        <Switch checked={enabled} disabled={busy} onChange={(e) => void toggle(e.target.checked)} />
      </label>
      {/* The curved elbow ties the row to the switch above it: it is a
          refinement of that switch, not a second lock. */}
      <label className="relative ml-6 flex items-center justify-between gap-3 p-3 bg-card-soft rounded-md text-control text-text">
        <span aria-hidden="true" className="absolute right-full top-[-12px] h-[calc(50%+12px)] w-3 border-l-2 border-b-2 border-border rounded-bl-md" />
        Also ask when returning from the background
        <Switch
          size="sm"
          checked={onResume}
          disabled={!enabled}
          onChange={(e) => {
            saveLockOnResume(e.target.checked);
            setOnResume(e.target.checked);
          }}
        />
      </label>
      {message ? <p role="status" className="m-0 text-hint text-warning leading-normal">{message}</p> : null}
    </div>
  );
}
