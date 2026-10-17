import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { authenticate, readLockEnabled, type AuthResult } from "../app-lock";
import { Button } from "../components/ui/Button";

// The Face ID sheet itself pauses the app, so events that arrive while it is
// up must not lock again or ask a second time. A resume asks only when this
// session locked on the way out: after a cancelled prompt the screen waits
// for the button instead of asking again in a loop.
export function AppLock({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(readLockEnabled);
  const [failure, setFailure] = useState<Extract<AuthResult, { ok: false }>["reason"] | null>(null);
  const lockedRef = useRef(locked);
  const askOnResumeRef = useRef(false);
  const askingRef = useRef(false);

  const unlock = useCallback(async () => {
    if (askingRef.current) return;
    askingRef.current = true;
    try {
      const result = await authenticate();
      setFailure(result.ok ? null : result.reason);
      if (result.ok) {
        lockedRef.current = false;
        setLocked(false);
      }
    } finally {
      askingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (lockedRef.current) void unlock();
  }, [unlock]);

  useEffect(() => {
    const listener = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (askingRef.current || !readLockEnabled()) return;
      if (!isActive && !lockedRef.current) {
        lockedRef.current = true;
        askOnResumeRef.current = true;
        setLocked(true);
      } else if (isActive && askOnResumeRef.current) {
        askOnResumeRef.current = false;
        void unlock();
      }
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [unlock]);

  return (
    <>
      <div className="contents" inert={locked}>{children}</div>
      {locked ? (
        <div role="dialog" aria-modal="true" aria-label="World is locked" className="fixed inset-0 z-50 grid place-content-center justify-items-center gap-4 p-6 bg-bg text-center">
          <h1 className="m-0 text-title font-bold text-text">World is locked</h1>
          {failure ? (
            <p className="m-0 text-control text-muted">
              {failure === "unavailable"
                ? "Face ID and the passcode are not available. Set a passcode in iOS Settings, then try again."
                : "Face ID did not match. Try again, or use your passcode."}
            </p>
          ) : null}
          <Button type="button" variant="primary" onClick={() => void unlock()}>Unlock with Face ID</Button>
        </div>
      ) : null}
    </>
  );
}
