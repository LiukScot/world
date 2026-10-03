import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiEnvelopeSchema, apiFetch } from "../lib";
import type { InlineMessage, MoodFieldKey, PainFieldKey } from "./core";
import { csvToList, listToCsv, mergeOptions } from "./core";

// Pill primitive shared by toggle/add/edit chips. Shape carries no color so
// idle/active color utilities don't collide on source order.
const CHIP_SHAPE =
  "inline-flex items-center gap-2 px-3 py-1 min-h-8 rounded-full text-hint leading-none border-0 shadow-none transition-[color,background] duration-150 ease-[ease]";
const CHIP_IDLE = "text-muted bg-[var(--control)]";
const CHIP_IDLE_HOVER = "hover:text-text hover:bg-[var(--control-hover)]";
// A filled pill, not a tinted one: at 10% accent the selected state was
// indistinguishable from idle in the Settings realm, where --accent is --text.
const CHIP_ACTIVE = "text-accent-fg bg-accent font-semibold";
const REMOVE_BTN =
  "inline-flex items-center justify-center w-[18px] h-[18px] min-h-[18px] p-0 rounded-full text-micro font-bold leading-none text-muted bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] border-0 shadow-none flex-none cursor-pointer [@media(hover:hover)]:hover:text-danger [@media(hover:hover)]:hover:bg-[color-mix(in_srgb,var(--danger)_15%,transparent)]";
const ADDER_BTN =
  "border-0 bg-transparent px-3 py-1 min-h-[24px] rounded-full text-xs font-semibold font-body shadow-none cursor-pointer transition-[color,background] duration-150 ease-[ease]";

type SectionHeadVariant = "default" | "dashboard" | "ds" | "tags" | "accent";
const SECTION_HEAD: Record<SectionHeadVariant, string> = {
  default: "flex justify-between gap-3 pb-1 mt-5",
  dashboard: "flex justify-between gap-3 pb-2 mt-5",
  ds: "flex flex-col gap-[2px] pb-1 mt-5",
  tags: "flex justify-between gap-3 mb-0",
  // A divider above each section, except the first one on the page.
  accent: "flex justify-between gap-3 pb-1 mt-5 pt-5 border-t border-border first:pt-0 first:border-t-0",
};
const SECTION_TITLE: Record<SectionHeadVariant, string> = {
  default: "[text-box:trim-both_cap_alphabetic] text-xs font-bold tracking-[0.16em] uppercase text-muted",
  dashboard: "[text-box:trim-both_cap_alphabetic] text-control font-bold tracking-[0.16em] uppercase text-accent",
  ds: "[text-box:trim-both_cap_alphabetic] text-xs font-bold tracking-[0.16em] uppercase text-muted",
  tags: "[text-box:trim-both_cap_alphabetic] text-xs font-bold tracking-[0.16em] uppercase text-muted",
  // The realm's accent: white in Settings, the realm colour elsewhere.
  accent: "[text-box:trim-both_cap_alphabetic] text-xs font-bold tracking-[0.16em] uppercase text-accent",
};
const SECTION_ASIDE: Record<SectionHeadVariant, string> = {
  default: "text-micro text-muted-soft tabular-nums",
  dashboard: "text-micro text-muted-soft tabular-nums",
  ds: "text-micro text-muted-soft tabular-nums",
  tags: "text-xs text-muted-soft",
  accent: "text-micro text-muted-soft tabular-nums",
};

export function InlineFeedback({ message, className }: { message: InlineMessage | null; className?: string }) {
  if (!message) {
    return null;
  }

  const toneColor = { error: "text-danger", success: "text-success", warning: "text-warning-soft", info: "text-muted" }[message.tone] ?? "text-muted";
  const classes = ["m-0 text-control leading-snug", toneColor, className].filter(Boolean).join(" ");
  const ariaLive = message.tone === "error" ? "assertive" : "polite";

  return (
    <p className={classes} role={message.tone === "error" ? "alert" : "status"} aria-live={ariaLive}>
      {message.text}
    </p>
  );
}

export function AnimatedEditingLabel({
  active,
  idleLabel = "Edit",
  editingLabel = "Editing",
}: {
  active: boolean;
  idleLabel?: string;
  editingLabel?: string;
}) {
  const [dotsCount, setDotsCount] = useState(1);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      setDotsCount((count) => (count % 3) + 1);
    }, 500);

    return () => window.clearInterval(timer);
  }, [active]);

  if (!active) {
    return idleLabel;
  }

  return (
    <span className="grid">
      <span className="[grid-area:1/1]">{editingLabel + ".".repeat(dotsCount)}</span>
      <span className="[grid-area:1/1] invisible" aria-hidden="true">{editingLabel}...</span>
    </span>
  );
}

type MultiSelectDomain = "pain" | "mood";

const domainConfig: Record<MultiSelectDomain, { apiBase: string; queryKey: string }> = {
  pain: { apiBase: "/api/v1/pain/options", queryKey: "pain-options" },
  mood: { apiBase: "/api/v1/mood/options", queryKey: "mood-options" },
};

type MultiSelectFieldProps = {
  label: string;
  fieldKey: PainFieldKey | MoodFieldKey;
  value: string;
  options: string[];
  onChange: (next: string) => void;
  domain?: MultiSelectDomain;
  /** When true, the visible heading is omitted (e.g. tabbed layout provides the label). */
  hideLabel?: boolean;
};

export function MultiSelectField({ label, fieldKey, value, options, onChange, domain = "pain", hideLabel = false }: MultiSelectFieldProps) {
  const { apiBase, queryKey: queryKeyName } = domainConfig[domain];
  const queryClient = useQueryClient();
  const selectedValues = useMemo(() => csvToList(value), [value]);
  const [hiddenSet, setHiddenSet] = useState<Set<string>>(() => new Set());
  const [pendingRemovalKey, setPendingRemovalKey] = useState<string | null>(null);
  const confirmRemoveRef = useRef<HTMLButtonElement | null>(null);
  const selectedSet = useMemo(() => new Set(selectedValues.map((entry) => entry.toLowerCase())), [selectedValues]);
  const allOptions = useMemo(() => {
    const merged = mergeOptions(options, selectedValues);
    if (!hiddenSet.size) return merged;
    return merged.filter((option) => {
      const key = option.toLowerCase();
      if (selectedSet.has(key)) return true;
      return !hiddenSet.has(key);
    });
  }, [options, selectedValues, hiddenSet, selectedSet]);
  const [customValue, setCustomValue] = useState("");
  const [editOptionsMode, setEditOptionsMode] = useState(false);
  const [addingOption, setAddingOption] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const addSuccessTimerRef = useRef<number | null>(null);
  const addInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (pendingRemovalKey) {
      confirmRemoveRef.current?.focus();
    }
  }, [pendingRemovalKey]);

  useEffect(() => () => {
    if (addSuccessTimerRef.current !== null) {
      window.clearTimeout(addSuccessTimerRef.current);
    }
  }, []);

  const toggleOption = (option: string) => {
    const key = option.trim().toLowerCase();
    if (!key) return;

    const isSelected = selectedValues.some((entry) => entry.trim().toLowerCase() === key);
    const nextValues = isSelected
      ? selectedValues.filter((entry) => entry.trim().toLowerCase() !== key)
      : [...selectedValues, option];

    onChange(listToCsv(nextValues));
  };

  const commitCustomValue = () => {
    const clean = customValue.trim();
    if (!clean) return;
    const nextValues = mergeOptions(selectedValues, [clean]);
    onChange(listToCsv(nextValues));
    setAddSuccess(true);
    if (addSuccessTimerRef.current !== null) {
      window.clearTimeout(addSuccessTimerRef.current);
    }
    addSuccessTimerRef.current = window.setTimeout(() => {
      setAddSuccess(false);
      addSuccessTimerRef.current = null;
    }, 900);
    setCustomValue("");
    setHiddenSet((current) => {
      const key = clean.toLowerCase();
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    setPendingRemovalKey((current) => (current === clean.toLowerCase() ? null : current));
    addInputRef.current?.focus();
    void (async () => {
      try {
        await apiFetch(
          `${apiBase}/restore`,
          {
            method: "POST",
            body: JSON.stringify({ field: fieldKey, value: clean }),
          },
          (raw) => apiEnvelopeSchema(z.object({ ok: z.boolean() })).parse(raw).data,
        );
        await queryClient.invalidateQueries({ queryKey: [queryKeyName] });
      } catch (e) {
        console.error("commitCustomValue: failed to sync restored option to server", e);
      }
    })();
  };

  const permanentlyRemoveOption = async (option: string) => {
    const key = option.trim().toLowerCase();
    if (!key) return;

    setPendingRemovalKey(null);
    setHiddenSet((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });

    const nextValues = selectedValues.filter((entry) => entry.trim().toLowerCase() !== key);
    onChange(listToCsv(nextValues));

    try {
      await apiFetch(
        `${apiBase}/remove`,
        {
          method: "POST",
          body: JSON.stringify({ field: fieldKey, value: option }),
        },
        (raw) => apiEnvelopeSchema(z.object({ ok: z.boolean() })).parse(raw).data,
      );
      await queryClient.invalidateQueries({ queryKey: [queryKeyName] });
    } catch (e) {
      console.error("permanentlyRemoveOption: failed to sync removal to server", e);
    }
  };

  const setEditMode = (next: boolean) => {
    setEditOptionsMode(next);
    if (next) {
      setAddingOption(false);
      return;
    }
    setPendingRemovalKey(null);
    setCustomValue("");
  };

  return (
    <div className="grid gap-2 content-start">
      {hideLabel ? null : <span className="flex flex-wrap mt-3 mb-3 pl-3 border-l-[3px] border-accent text-sm font-semibold text-accent leading-tight">{label}</span>}
      <div className="flex flex-wrap gap-2 content-start mt-[5px] mb-[5px] order-1" role="group" aria-label={label}>
        {allOptions.map((option) => {
          const optionKey = option.toLowerCase();
          const isSelected = selectedSet.has(optionKey);
          const isConfirmingRemoval = pendingRemovalKey === optionKey;

          if (isConfirmingRemoval) {
            return (
              <div key={option} className="inline-flex items-center gap-2 flex-wrap px-3 py-2 border border-[color-mix(in_srgb,var(--danger)_50%,transparent)] rounded-full bg-[color-mix(in_srgb,var(--danger)_8%,transparent)]" role="group" aria-label={`Confirm removal of ${option}`}>
                <span className="whitespace-nowrap text-text text-control">Remove {option}?</span>
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    ref={confirmRemoveRef}
                    className="danger min-h-8 px-3 py-1 text-xs shadow-none"
                    onClick={() => {
                      void permanentlyRemoveOption(option);
                    }}
                  >
                    Remove
                  </button>
                  <button type="button" className="min-h-8 px-3 py-1 text-xs shadow-none" onClick={() => setPendingRemovalKey(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={option} className="inline-flex items-center">
              {editOptionsMode ? (
                <div className={`${CHIP_SHAPE} ${isSelected ? CHIP_ACTIVE : CHIP_IDLE} cursor-default`}>
                  <span className="whitespace-nowrap">{option}</span>
                  <button
                    type="button"
                    className={REMOVE_BTN}
                    aria-label={`Remove ${option} from suggestions`}
                    onClick={() => setPendingRemovalKey(optionKey)}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`${CHIP_SHAPE} ${isSelected ? CHIP_ACTIVE : `${CHIP_IDLE} ${CHIP_IDLE_HOVER}`}`}
                  onClick={() => toggleOption(option)}
                  aria-pressed={isSelected}
                >
                  <span className="whitespace-nowrap">{option}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-1">
        {addingOption ? (
          <div className="inline-flex items-center gap-2 pl-3 pr-1 py-[2px] border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] rounded-full bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] min-h-8">
            <input
              ref={addInputRef}
              autoFocus
              type="text"
              className="flex-[1_1_140px] min-w-30 max-w-72 w-auto border-0 bg-transparent p-0 text-text text-control font-medium font-body shadow-none outline-none focus:bg-transparent focus:shadow-none placeholder:text-muted-soft"
              placeholder={`New ${label.toLowerCase()}`}
              value={customValue}
              onChange={(event) => setCustomValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitCustomValue();
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setAddingOption(false);
                  setCustomValue("");
                }
              }}
            />
            <button
              type="button"
              className={`${ADDER_BTN} ${addSuccess ? "text-success bg-[color-mix(in_srgb,var(--success)_16%,transparent)]" : "text-accent hover:text-text"}`}
              aria-label="Save option"
              onClick={commitCustomValue}
            >
              {addSuccess ? "\u2713" : "Add"}
            </button>
            <button
              type="button"
              className={`${ADDER_BTN} text-muted-soft hover:text-text`}
              aria-label="Cancel"
              onClick={() => {
                setAddingOption(false);
                setCustomValue("");
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              className={`${CHIP_SHAPE} text-muted-soft bg-[var(--control)] font-medium enabled:hover:text-text enabled:hover:bg-[var(--control-hover)] disabled:opacity-40 disabled:cursor-not-allowed`}
              onClick={() => setAddingOption(true)}
              disabled={editOptionsMode}
            >
              + add option
            </button>
            <button
              type="button"
              className={`border-0 rounded-full px-3 py-1 min-h-8 text-hint font-medium leading-none shadow-none cursor-pointer transition-[color,background] duration-150 ease-[ease] ${editOptionsMode ? "text-accent bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]" : "text-muted-soft bg-[var(--control)] hover:text-text hover:bg-[var(--control-hover)]"}`}
              aria-pressed={editOptionsMode}
              onClick={() => setEditMode(!editOptionsMode)}
            >
              {editOptionsMode ? "done" : "edit"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Small titled divider used to group sub-sections across pages. */
export function SectionHead({ title, aside, variant = "default" }: { title: string; aside?: ReactNode; variant?: SectionHeadVariant }) {
  const align = variant === "ds" ? "items-start" : "items-baseline";
  return (
    <div className={`${SECTION_HEAD[variant]} ${align}`}>
      <span className={SECTION_TITLE[variant]}>{title}</span>
      {aside != null ? <span className={SECTION_ASIDE[variant]}>{aside}</span> : null}
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSplitColumnHeightSync(deps: ReadonlyArray<unknown> = []) {
  const leftColRef = useRef<HTMLElement | null>(null);
  const rightColRef = useRef<HTMLElement | null>(null);

  const syncHeights = useCallback(() => {
    const left = leftColRef.current;
    const right = rightColRef.current;
    if (!left || !right) return;
    const height = Math.round(left.getBoundingClientRect().height);
    if (height > 0) {
      right.style.setProperty("--split-col-height", `${height}px`);
    }
  }, []);

  useLayoutEffect(() => {
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(syncHeights);
    };
    schedule();

    const left = leftColRef.current;
    const right = rightColRef.current;
    const hasRO = typeof ResizeObserver !== "undefined";
    const ro = hasRO ? new ResizeObserver(schedule) : null;
    if (ro) {
      if (left) ro.observe(left);
      if (right) ro.observe(right);
    }
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", schedule);
    };
  // deps intentionally let caller re-sync when screen data changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncHeights, ...deps]);

  return { leftColRef, rightColRef };
}
