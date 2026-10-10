import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SectionHead, useSplitColumnHeightSync } from "./shared";
import { MS_PER_DAY, toDateKey, type MemorableDay } from "./core";
import { type useMemorableDays } from "../hooks/use-memorable-days";
import { Button, buttonClass } from "../components/ui/Button";
import { EntriesHeading } from "./entries";
import { MemorableDayModal, type DraftState } from "./memorable-day-modal";
import { PAGE_TITLE } from "./screen-helpers";
import {
  MEMO_BACKDROP,
  MEMO_MODAL,
  MEMO_DAY_CELL,
  MEMO_LIST_ITEM,
  MEMO_MODAL_ACTIONS,
  DAY_NUMBER,
} from "./memorable-days-constants";

export { MEMO_DAY_CELL, MEMO_LIST_ITEM, DAY_NUMBER, EMOJI_TRIGGER } from "./memorable-days-constants";

type Props = {
  memorable: ReturnType<typeof useMemorableDays>;
};

function buildCalendarDays(month: Date, weekStart: "sunday" | "monday") {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const firstOffset = weekStart === "monday" ? (firstDay.getDay() + 6) % 7 : firstDay.getDay();
  const lastOffset = weekStart === "monday" ? (6 - ((lastDay.getDay() + 6) % 7)) : (6 - lastDay.getDay());
  const start = new Date(firstDay);
  start.setDate(start.getDate() - firstOffset);
  const end = new Date(lastDay);
  end.setDate(end.getDate() + lastOffset);
  const dayCount = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  return Array.from({ length: dayCount }, (_, index) => {
    const value = new Date(start);
    value.setDate(start.getDate() + index);
    return value;
  });
}

function emptyDraft(date: string): DraftState {
  return { id: null, date, title: "", emoji: "", description: "" };
}

function buildMemorableLookup(items: MemorableDay[]): Map<string, MemorableDay[]> {
  const byDate = new Map<string, MemorableDay[]>();
  for (const item of items) {
    byDate.set(item.date, [...(byDate.get(item.date) ?? []), item]);
  }
  return byDate;
}

export function MemorableDaysSection({ memorable }: Props) {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [successDateKey, setSuccessDateKey] = useState<string | null>(null);
  const [popoverDateKey, setPopoverDateKey] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const weekdayLabels = memorable.weekStart === "monday"
    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days = useMemo(() => buildCalendarDays(memorable.visibleMonth, memorable.weekStart), [memorable.visibleMonth, memorable.weekStart]);
  const itemsByDate = useMemo(() => buildMemorableLookup(memorable.memorableDays), [memorable.memorableDays]);
  const todayKey = toDateKey(new Date());
  const { leftColRef, rightColRef } = useSplitColumnHeightSync([days.length, memorable.memorableDays.length, memorable.isLoading]);
  const popoverItems = popoverDateKey ? itemsByDate.get(popoverDateKey) ?? [] : [];

  useEffect(() => {
    if (!successDateKey) return;
    const timer = window.setTimeout(() => setSuccessDateKey(null), 2500);
    return () => window.clearTimeout(timer);
  }, [successDateKey]);

  useEffect(() => {
    if (!popoverDateKey) return;
    const onMouseDown = (event: MouseEvent) => {
      if (popoverRef.current?.contains(event.target as Node)) return;
      setPopoverDateKey(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPopoverDateKey(null);
    };
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [popoverDateKey]);

  const closeDraft = useCallback(() => setDraft(null), []);

  const openCreate = (date: string) => setDraft(emptyDraft(date));

  const openEdit = (item: MemorableDay) => {
    memorable.setVisibleMonth(new Date(`${item.date}T00:00:00`));
    setDraft({
      id: item.id,
      date: item.date,
      title: item.title,
      emoji: item.emoji,
      description: item.description,
    });
  };

  const handleSave = useCallback(async (savedDraft: DraftState) => {
    const payload = {
      date: savedDraft.date,
      title: savedDraft.title,
      emoji: savedDraft.emoji,
      description: savedDraft.description,
    };
    if (savedDraft.id) await memorable.updateMemorableDay(savedDraft.id, payload);
    else await memorable.createMemorableDay(payload);
    setSuccessDateKey(savedDraft.date);
    closeDraft();
  }, [memorable, closeDraft]);

  const handleDelete = useCallback(async (id: number) => {
    await memorable.deleteMemorableDay(id);
    closeDraft();
  }, [memorable, closeDraft]);

  /*
   * The modal calls this from an effect keyed on the callback, and `memorable`
   * is a new object every render. A callback that depends on it, or that
   * stores a new Date for a month already shown, re-runs that effect on every
   * render: the page re-renders for as long as the modal is open. Hence the
   * stable setter alone, and the same state object for the same month.
   */
  const { setVisibleMonth } = memorable;
  const handleDraftDateChange = useCallback((date: string) => {
    const [year, month] = date.split("-").map(Number);
    if (!year || !month) return;
    setVisibleMonth((current) =>
      current.getFullYear() === year && current.getMonth() === month - 1 ? current : new Date(year, month - 1, 1));
  }, [setVisibleMonth]);

  const onListItemWheel = (event: React.WheelEvent<HTMLButtonElement>) => {
    const list = event.currentTarget.closest(".memorable-list");
    if (!(list instanceof HTMLElement)) return;
    if (list.scrollHeight <= list.clientHeight + 1) return;
    const newScrollTop = Math.max(0, Math.min(list.scrollTop + event.deltaY, list.scrollHeight - list.clientHeight));
    if (newScrollTop !== list.scrollTop) {
      list.scrollTop = newScrollTop;
      event.preventDefault();
    }
  };

  return (
    <section className="@container p-2 relative">
      <div>
        <div>
          <h1 className={`${PAGE_TITLE} mb-page`}>Memorable days</h1>
          <div className="max-mobile:hidden">
            <SectionHead title="Calendar" variant="dashboard" />
          </div>
        </div>
      </div>
      <Button variant="primary" className="absolute top-8 right-2 max-mobile:hidden" onClick={() => openCreate(toDateKey(new Date()))}>Add new</Button>

      <div className="grid gap-12 items-start grid-cols-[minmax(0,1.55fr)_minmax(280px,0.9fr)] max-xwide:grid-cols-1 max-xwide:gap-0">
        <section ref={leftColRef} className="min-w-0 p-0 max-xwide:border-b max-xwide:border-border max-xwide:pb-8 max-mobile:hidden">
          <div className="flex items-center justify-between gap-2 mb-8 min-w-0">
            <Button className="flex-shrink-0 tracking-[0.01em]" onClick={() => memorable.setVisibleMonth(new Date(memorable.visibleMonth.getFullYear(), memorable.visibleMonth.getMonth() - 1, 1))}>
              Prev
            </Button>
            <Button
              className="tracking-[0.01em] min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
              onClick={() => memorable.setVisibleMonth(new Date())}
              aria-label="Go to current month"
            >
              {new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", year: "numeric" }).format(new Date())}
            </Button>
            <Button className="flex-shrink-0 tracking-[0.01em]" onClick={() => memorable.setVisibleMonth(new Date(memorable.visibleMonth.getFullYear(), memorable.visibleMonth.getMonth() + 1, 1))}>
              Next
            </Button>
          </div>
          <div className="flex items-center gap-2 mb-2">
            {weekdayLabels.map((label) => <span key={label} className="flex-1 text-center text-muted text-xs font-bold uppercase">{label}</span>)}
          </div>
          <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] gap-2">
            {days.map((day) => {
              const dayKey = toDateKey(day);
              const monthMatch = day.getMonth() === memorable.visibleMonth.getMonth();
              const isToday = dayKey === todayKey;
              const isSuccess = dayKey === successDateKey;
              const items = itemsByDate.get(dayKey) ?? [];
              return (
                <div
                  key={dayKey}
                  className={`${MEMO_DAY_CELL}${monthMatch ? "" : " opacity-[0.48]"}${isToday ? " shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_28%,transparent)]" : ""}${isSuccess ? " shadow-[0_0_0_2px_var(--success)]" : ""}`}
                  onClick={(event) => {
                    if ((event.target as Element).closest("button")) return;
                    if (items.length > 0) setPopoverDateKey(popoverDateKey === dayKey ? null : dayKey);
                    else openCreate(dayKey);
                  }}
                >
                  <span className="flex items-center justify-between">
                    <button
                      type="button"
                      className={DAY_NUMBER}
                      aria-label={items.length > 0 ? `View events on ${dayKey}` : `${day.getDate()}`}
                      onClick={() => {
                        if (items.length > 0) setPopoverDateKey(popoverDateKey === dayKey ? null : dayKey);
                      }}
                    >
                      {day.getDate()}
                    </button>
                  </span>
                  <span className="flex flex-col gap-2">
                    {items.slice(0, 2).map((item) => (
                      <span key={item.id} className="text-xs leading-snug text-muted whitespace-nowrap overflow-hidden text-ellipsis">
                        {item.emoji || "•"} {item.title}
                      </span>
                    ))}
                    {items.length > 2 ? (
                      <span className="text-micro font-semibold text-accent leading-snug opacity-75">+{items.length - 2} more</span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section ref={rightColRef} className="min-w-0 flex flex-col min-h-0 overflow-hidden h-[var(--split-col-height,auto)] max-h-[var(--split-col-height,none)] max-xwide:h-auto max-xwide:max-h-none max-xwide:pt-5 max-[980px]:pt-0">
          <EntriesHeading className="mb-5">All memorable days</EntriesHeading>
          {memorable.isLoading ? (
            <p className="text-muted text-control">Loading memorable days...</p>
          ) : memorable.memorableDays.length === 0 ? (
            <div className="grid gap-2 my-3">
              <p className="text-control font-semibold text-text m-0">No memorable days yet</p>
              <p className="max-w-[60ch] text-control text-muted leading-normal m-0">Add one date worth remembering to start the list.</p>
            </div>
          ) : (
            <div className="memorable-list flex flex-col flex-[1_1_auto] min-h-0 overflow-y-auto overflow-x-hidden gap-3 [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:rgba(255,255,255,0.18)_transparent] focus-within:[scrollbar-color:rgba(255,255,255,0.18)_transparent] max-xwide:max-h-none max-mobile:pb-20">
              {memorable.memorableDays.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={MEMO_LIST_ITEM}
                  onWheelCapture={onListItemWheel}
                  onClick={() => openEdit(item)}
                >
                  <span className="text-title leading-none">{item.emoji || "✨"}</span>
                  <span className="flex-1 min-w-0 flex flex-col gap-1 items-start">
                    <span className="w-full flex items-baseline justify-between gap-3">
                      <strong className="text-base min-w-0 truncate text-text">{item.title}</strong>
                      <span className="text-muted text-control flex-shrink-0 whitespace-nowrap text-right">{item.date}</span>
                    </span>
                    {item.description ? (
                      <span className="text-micro text-muted-soft w-full text-left truncate">{item.description}</span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <button
        type="button"
        className="mobile:hidden fixed bottom-[calc(24px+env(safe-area-inset-bottom))] right-6 z-20 w-14 h-14 flex items-center justify-center rounded-full border-0 cursor-pointer bg-accent text-accent-fg text-2xl leading-none shadow-[var(--shadow)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)]"
        aria-label="Add memorable day"
        onClick={() => openCreate(toDateKey(new Date()))}
      >
        +
      </button>

      {draft ? (
        <MemorableDayModal
          initialDraft={draft}
          isSaving={memorable.isSaving}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={closeDraft}
          onDraftDateChange={handleDraftDateChange}
        />
      ) : null}

      {popoverDateKey ? (
        <div className={MEMO_BACKDROP} role="presentation" onClick={() => setPopoverDateKey(null)}>
          <div ref={popoverRef} className={MEMO_MODAL} role="dialog" aria-modal="true" aria-label={`Events on ${popoverDateKey}`} onClick={(event) => event.stopPropagation()}>
            <SectionHead title={popoverDateKey} variant="dashboard" />
            <div className="flex flex-col gap-2 m-0 mb-2">
              {popoverItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex items-center gap-3 bg-card-soft border-0 shadow-none min-h-0 p-[8px_12px] rounded-md text-text text-left cursor-pointer w-full transition-[background] duration-150 ease-[ease] hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
                  onClick={() => {
                    setPopoverDateKey(null);
                    openEdit(item);
                  }}
                >
                  <span className="text-xl flex-shrink-0">{item.emoji || "✨"}</span>
                  <span className="flex flex-col gap-[2px]">
                    <strong className="text-text">{item.title}</strong>
                    {item.description ? <span className="text-micro text-muted-soft">{item.description}</span> : null}
                  </span>
                </button>
              ))}
            </div>
            <div className={MEMO_MODAL_ACTIONS}>
              <Button variant="primary" onClick={() => { setPopoverDateKey(null); openCreate(popoverDateKey); }}>
                Add new
              </Button>
              <button type="button" className={buttonClass("default", "md", "!bg-[color-mix(in_srgb,var(--text)_10%,transparent)] hover:!bg-[color-mix(in_srgb,var(--text)_16%,transparent)]")} onClick={() => setPopoverDateKey(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
