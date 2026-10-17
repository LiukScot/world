import type { ReactNode } from "react";

/*
 * Dashboard anatomy, shared by the Health and Money dashboards.
 *
 * Two problems it answers. Every card carried the same weight, so no
 * number led and the page had no subject. And the two
 * dashboards had grown different card grammars — one with emoji and
 * delta pills, one bare — so the realms read as two apps.
 *
 * Here one metric is the hero and the rest are a tier below it, and the
 * columns are declared per breakpoint rather than auto-filled: an orphan
 * card on a row of its own is not expressible.
 */

export const DASH_SECTION = "grid gap-5 min-w-0";

export function SectionRow({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="[text-box:trim-both_cap_alphabetic] text-control font-bold tracking-[0.16em] uppercase text-accent">{title}</span>
      {aside != null ? <span className="ml-auto text-micro text-muted-soft">{aside}</span> : null}
    </div>
  );
}

export const DASH_CARD_SURFACE = "grid gap-3 content-start p-5 rounded-md bg-card-soft min-w-0";
/*
 * Hero on its own row, the rest in a fixed three (two on mobile). Column
 * counts are declared rather than auto-filled, so what lands on the last
 * row is a property of the design and not of the viewport — auto-fill is
 * how a single card ends up alone on a row nobody designed.
 */
export const KPI_TIER = "grid gap-3 min-w-0 grid-cols-2 wide:grid-cols-3";

const KPI_LABEL = "text-nano font-extrabold tracking-[0.12em] uppercase text-muted";

export type KpiTone = "positive" | "negative" | "flat";

const DELTA_TONE: Record<KpiTone, string> = {
  positive: "bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-success",
  negative: "bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-danger",
  flat: "bg-[color-mix(in_srgb,var(--muted)_14%,transparent)] text-muted",
};
export type KpiDirection = "up" | "down" | "flat";
// Colour says good or bad, the arrow says up or down: a rising pain average
// is red and still points up.
const DELTA_MARK: Record<KpiDirection, string> = { up: "▲", down: "▼", flat: "—" };

export function Kpi({
  label,
  value,
  valueTone,
  delta,
  sub,
  hero = false,
}: {
  label: string;
  value: string;
  valueTone?: KpiTone;
  delta?: { text: string; tone: KpiTone; direction: KpiDirection };
  sub?: string;
  hero?: boolean;
}) {
  const tone = valueTone === "positive" ? "text-success" : valueTone === "negative" ? "text-danger" : "text-text";
  return (
    <article className={DASH_CARD_SURFACE}>
      <span className={KPI_LABEL}>{label}</span>
      <strong className={`${hero ? "text-[34px] tracking-[-0.02em]" : "text-lg"} font-extrabold leading-none ${tone}`}>{value}</strong>
      {delta ? (
        <span className={`justify-self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-micro font-bold ${DELTA_TONE[delta.tone]}`}>
          <span aria-hidden="true">{DELTA_MARK[delta.direction]}</span>
          {delta.text}
        </span>
      ) : null}
      {sub ? <span className="text-micro text-muted">{sub}</span> : null}
    </article>
  );
}

/*
 * Numbers that are one fact rather than three: one surface with dividers,
 * so they cannot orphan onto a row of their own the way three cards can.
 */
export function KpiTriple({ children }: { children: ReactNode }) {
  return (
    <article className="grid grid-cols-[repeat(3,minmax(0,1fr))] max-mobile:grid-cols-[minmax(0,1fr)] rounded-md bg-card-soft overflow-hidden min-w-0 [&>*+*]:border-l [&>*+*]:border-[color-mix(in_srgb,var(--border)_35%,transparent)] max-mobile:[&>*+*]:border-l-0 max-mobile:[&>*+*]:border-t">
      {children}
    </article>
  );
}

export function KpiCell({ label, value, tone }: { label: string; value: string; tone?: KpiTone }) {
  const color = tone === "positive" ? "text-success" : tone === "negative" ? "text-danger" : "text-text";
  return (
    <div className="grid gap-2 content-start p-5 min-w-0">
      <span className={KPI_LABEL}>{label}</span>
      <strong className={`text-lg font-extrabold leading-none ${color}`}>{value}</strong>
    </div>
  );
}

/*
 * A chart sits on the same surface, under the same heading style, as
 * everything else on the page. The money charts used to render straight
 * onto the page background with their own smaller heading — the whole of
 * the reported "graphs look off".
 */
export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className={DASH_CARD_SURFACE}>
      <span className="text-micro font-bold tracking-[0.12em] uppercase text-muted">{title}</span>
      {children}
    </article>
  );
}

export const CHART_ROW = "grid gap-3 items-start min-w-0 wide:grid-cols-2";

/*
 * Loading: one skeleton per card that will arrive, so the page does not
 * jump when the data lands (#17 — the dashboards showed a bare line of
 * text and then reflowed).
 */
export function KpiSkeleton({ hero = false }: { hero?: boolean }) {
  return (
    <div className={DASH_CARD_SURFACE} aria-hidden="true">
      <span className="h-2.5 w-16 rounded-full bg-[color-mix(in_srgb,var(--text)_10%,transparent)]" />
      <span className={`${hero ? "h-8 w-40" : "h-5 w-20"} rounded-sm bg-[color-mix(in_srgb,var(--text)_10%,transparent)]`} />
    </div>
  );
}
