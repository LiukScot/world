import { useEffect, useState } from "react";

/** Loads faster than this show nothing, so a quick page never flashes a placeholder. */
const SHOW_AFTER_MS = 150;

/**
 * Grey bars that hold the place of content still loading. Appears only after
 * SHOW_AFTER_MS; `label` is what a screen reader hears meanwhile.
 */
export function Skeleton({ label, lines = 3, className = "" }: { label: string; lines?: number; className?: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div role="status" aria-busy="true" className={`grid gap-3 ${className}`}>
      <span className="sr-only">{label}</span>
      {visible &&
        Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="h-12 rounded-md bg-card-soft motion-safe:animate-pulse"
            style={{ width: i === lines - 1 ? "70%" : "100%" }}
          />
        ))}
    </div>
  );
}
