import type { ReactNode } from "react";
import { groupByMonth } from "./screen-format";

// Past-entries primitives shared by CBT/DBT/Diary/Pain. The summary layout
// differs per screen (badges, mood, preview), so these expose styled wrappers
// + class constants the screens compose, rather than one rigid component.

export const ENTRY_ROW =
  "group/row border-0 border-b border-border rounded-none m-0 overflow-hidden bg-transparent transition-[background] duration-150 ease-[ease]";
export const ENTRY_SUMMARY =
  "group/sum list-none grid grid-cols-[auto_auto_1fr_auto_auto] items-center gap-3 px-[2px] py-3 cursor-pointer border-0 rounded-none shadow-none bg-transparent min-h-0 [&::-webkit-details-marker]:hidden";
export const ENTRY_DATE =
  "font-medium text-xs font-mono text-muted min-w-[110px] tabular-nums tracking-wide group-hover/sum:text-text";
export const ENTRY_PREVIEW =
  "text-control text-muted overflow-hidden text-ellipsis whitespace-nowrap group-hover/sum:text-text";
export const ENTRY_CHEVRON =
  "text-muted-soft transition-transform duration-200 ease-[ease] text-nano group-open/row:rotate-90";
export const ENTRY_EXPANDED =
  "px-[2px] pt-2 pb-3 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3";
export const DETAIL_ACTIONS = "[grid-column:1/-1] flex gap-1 justify-end -mt-1";
export const DETAIL_ACTION_BTN =
  "px-2 py-1 text-xs font-medium text-muted bg-transparent border-0 rounded-[6px] shadow-none cursor-pointer font-[inherit] transition-[color,background] duration-150 ease-[ease] hover:text-text hover:bg-[color-mix(in_srgb,var(--text)_8%,transparent)]";
export const DELETE_CONFIRM = "text-danger-strong bg-danger-strong/18 font-extrabold";

// No outer margin: every caller was passing mt-0 to undo one, which is the
// tell that the constant owned spacing it had no business owning.
export function EntriesHeading({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`[text-box:trim-both_cap_alphabetic] text-control text-accent uppercase tracking-[0.16em] font-bold ${className}`}>
      {children}
    </h2>
  );
}

/*
 * New entry / History. The log is a sibling view of the form, not a tail
 * below it: on a page whose form is a screenful, the list was only ever
 * reachable by scrolling past everything. The state lives in App so the
 * mobile sticky head can carry the same control.
 */
export type EntryView = "new" | "history";

const VIEW_TAB = "px-3.5 py-1.5 rounded-full text-control font-semibold border-0 shadow-none cursor-pointer transition-[color,background] duration-150 ease-[ease]";
const VIEW_TAB_ON = "bg-accent text-accent-fg";
const VIEW_TAB_OFF = "bg-transparent text-muted hover:text-text";

export function EntryViewTabs({
  view,
  onChange,
  labels,
  className = "",
}: {
  view: EntryView;
  onChange: (next: EntryView) => void;
  /** From entryViewLabels: one source for the page and the mobile head. */
  labels: { newEntry: string; history: string };
  /** Must set a display: the component declares none, so a caller's
   *  `hidden` cannot lose a source-order fight with a base `inline-flex`. */
  className: string;
}) {
  return (
    /*
     * A toggle group, not a tablist: there is no tabpanel to point
     * aria-controls at, and role="tab" carries a keyboard contract
     * (roving tabindex, arrow keys) that a two-button switch does not
     * need. Buttons with aria-pressed say the same thing honestly.
     */
    <div className={`gap-1 p-1 justify-self-start rounded-full bg-card-strong ${className}`} role="group" aria-label="Entry or history">
      <button
        type="button"
        aria-pressed={view === "new"}
        className={`${VIEW_TAB} ${view === "new" ? VIEW_TAB_ON : VIEW_TAB_OFF}`}
        onClick={() => onChange("new")}
      >
        {labels.newEntry}
      </button>
      <button
        type="button"
        aria-pressed={view === "history"}
        className={`${VIEW_TAB} ${view === "history" ? VIEW_TAB_ON : VIEW_TAB_OFF}`}
        onClick={() => onChange("history")}
      >
        {labels.history}
      </button>
    </div>
  );
}

// The entry log. Every row is rendered: the list used to sit in a
// right-hand column capped to the form's height, which clipped the
// overflow behind a fade and a "Show more" button that was never wired to
// anything, so the clipped rows had no way back.
export function PastEntries({
  title,
  isLoading,
  loadingText,
  isEmpty,
  emptyState,
  children,
}: {
  title?: ReactNode;
  isLoading: boolean;
  loadingText: string;
  isEmpty: boolean;
  emptyState: ReactNode;
  children: ReactNode;
}) {
  // The gap is the container's: EntriesHeading carries no margin of its
  // own, so without this the heading sits on top of the first row.
  return (
    <div className="grid gap-5 content-start min-w-0">
      {isLoading && <p className="text-muted text-control">{loadingText}</p>}
      {title ? <EntriesHeading>{title}</EntriesHeading> : null}
      {isEmpty ? emptyState : children}
    </div>
  );
}

/*
 * Rows cut into months, each run under its own heading with a count. The
 * caller keeps rendering its own row: the summary differs per tracker
 * (badges, mood, preview) and only the grouping is shared.
 */
export function EntryMonths<T>({
  rows,
  dateOf,
  renderRow,
}: {
  rows: T[];
  dateOf: (row: T) => string;
  renderRow: (row: T) => ReactNode;
}) {
  return (
    <div className="grid gap-page">
      {groupByMonth(rows, dateOf).map((group, index) => (
        <section key={`${group.key}-${index}`} className="grid gap-3">
          <div className="flex items-baseline gap-3">
            <span className="[text-box:trim-both_cap_alphabetic] text-xs font-bold tracking-[0.16em] uppercase text-muted">{group.label}</span>
            <span className="ml-auto text-micro text-muted-soft tabular-nums">
              {group.rows.length === 1 ? "1 entry" : `${group.rows.length} entries`}
            </span>
          </div>
          <div className="min-w-0">{group.rows.map(renderRow)}</div>
        </section>
      ))}
    </div>
  );
}

// Inline tag chip inside an expanded entry's detail value (former .tag-mini).
export const TAG_MINI =
  "py-[2px] px-2 text-micro text-muted bg-[color-mix(in_srgb,var(--card)_60%,var(--card-strong))] rounded-[4px]";

// Accent-underline tab button shape (no color), shared by TagTabs + Settings tabs.
export const TAG_TAB_BTN =
  "inline-flex items-center gap-2 py-1 px-0 text-control font-medium bg-transparent border-0 border-b rounded-none shadow-none cursor-pointer font-[inherit] whitespace-nowrap min-h-0 transition-[color,border-color] duration-150 ease-[ease]";

// Accent-underline tab strip shared by Diary (moods) and Pain (medicines).
export function TagTabs<T extends string>({
  tabs,
  active,
  onSelect,
  ariaLabel,
}: {
  tabs: { id: T; label: string; count: number }[];
  active: T;
  onSelect: (id: T) => void;
  ariaLabel: string;
}) {
  return (
    <nav className="flex flex-wrap gap-y-1 gap-x-5" role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={`${TAG_TAB_BTN} ${active === t.id ? "text-text border-b-accent" : "text-muted border-b-transparent hover:text-text"}`}
          onClick={() => onSelect(t.id)}
        >
          {t.label} <span className={`text-micro font-medium ${active === t.id ? "text-accent" : "text-muted-soft"}`}>{t.count}</span>
        </button>
      ))}
    </nav>
  );
}

// Renders a list of tag chips inside a detail value, or an em-dash when empty.
export function TagList({ items }: { items: string[] }) {
  if (!items.length) return <>—</>;
  return (
    <>
      {items.map((t) => (
        <span key={t} className={TAG_MINI}>{t}</span>
      ))}
    </>
  );
}

/*
 * A field of an expanded entry. Renders nothing when there is nothing to
 * show: an entry with three of nine fields filled used to read as six em
 * dashes, which buries the three that carry the answer. `empty` lets a
 * caller declare emptiness the value alone cannot express — an all-zero
 * count, a tag list that came back with no members.
 */
export function DetailGroup({ label, children, empty }: { label: ReactNode; children: ReactNode; empty?: boolean }) {
  const blank = empty ?? (children == null || children === "" || children === "—");
  if (blank) {
    return null;
  }

  return (
    <div className="grid gap-1">
      <span className="text-micro text-muted uppercase tracking-wider">{label}</span>
      <span className="text-control flex flex-wrap gap-1 text-text">{children}</span>
    </div>
  );
}

type PainBadgeVariant = "low" | "mid" | "high" | "muted";
const PAIN_BADGE: Record<PainBadgeVariant, string> = {
  low: "bg-success text-success-fg",
  mid: "bg-warning text-warning-fg",
  high: "bg-danger text-white",
  muted: "bg-[color-mix(in_srgb,var(--card)_50%,var(--border))] text-muted",
};

export function PainBadge({
  variant,
  sm = false,
  children,
}: {
  variant: PainBadgeVariant;
  sm?: boolean;
  children: ReactNode;
}) {
  const size = sm ? "min-w-[24px] h-[24px] text-xs px-1" : "min-w-[30px] h-[30px] text-sm px-2";
  return (
    <span className={`inline-flex items-center justify-center rounded-[8px] font-extrabold ${size} ${PAIN_BADGE[variant]}`}>
      {children}
    </span>
  );
}
