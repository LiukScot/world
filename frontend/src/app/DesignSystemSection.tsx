import { useState } from "react";
import { PAGE_TITLE } from "./screen-helpers";
import { STAGE, StageField, StageHead, StageScale, StageStepper } from "./staged";
import { FIELD_LINE_INPUT } from "../components/ui/FieldLine";
import { Button } from "../components/ui/Button";
import { Switch } from "../components/ui/Switch";
import { DATE_TIME_INPUT } from "../components/ui/DateInput";
import { FieldLine } from "../components/ui/FieldLine";
import { SectionHead } from "./shared";
import { NAV_ITEM, NAV_ITEM_ACTIVE, NAV_ITEM_IDLE } from "./Sidebar";
import { DAY_NUMBER, EMOJI_TRIGGER, MEMO_DAY_CELL, MEMO_LIST_ITEM } from "./memorable-days";
import {
  DetailGroup,
  EntriesHeading,
  ENTRY_CHEVRON,
  ENTRY_DATE,
  ENTRY_EXPANDED,
  ENTRY_PREVIEW,
  ENTRY_ROW,
  ENTRY_SUMMARY,
  PainBadge,
  TAG_MINI,
  TagTabs,
} from "./entries";


const DESIGN_COLOR_TOKENS: { name: string; varName: string; role: string }[] = [
  { name: "Background", varName: "--bg", role: "App canvas" },
  { name: "Card", varName: "--card", role: "Panels, inputs" },
  { name: "Card strong", varName: "--card-strong", role: "Elevated surfaces" },
  { name: "Card soft", varName: "--card-soft", role: "Subtle fills" },
  { name: "Text", varName: "--text", role: "Primary text" },
  { name: "Muted", varName: "--muted", role: "Secondary text" },
  { name: "Muted soft", varName: "--muted-soft", role: "Tertiary text" },
  { name: "Border", varName: "--border", role: "Dividers, hairlines" },
  { name: "Accent", varName: "--accent", role: "Primary action" },
  { name: "Success", varName: "--success", role: "Positive state" },
  { name: "Warning", varName: "--warning", role: "Mid state" },
  { name: "Danger", varName: "--danger", role: "Negative state" },
];

const DS_MEMORABLE_WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const DS_SIDEBAR_DEMO_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden width={20} height={20}>
    <circle cx="12" cy="12" r="7" />
  </svg>
);

export function DesignSystemSection() {
  const [moodDemo, setMoodDemo] = useState<number | null>(6);
  const [painDemo, setPainDemo] = useState<number | null>(3);
  const [coffeeDemo, setCoffeeDemo] = useState<number | null>(2);
  const [tabDemo, setTabDemo] = useState<"positive" | "negative" | "general">("positive");

  return (
    <section className="@container p-2">
      <h1 className={`${PAGE_TITLE} mb-page`}>Design System</h1>
      <p className="text-muted text-control mt-2 mb-5 max-w-[72ch] [&_code]:px-[6px] [&_code]:py-[1px] [&_code]:rounded-[6px] [&_code]:bg-card-soft [&_code]:text-text">
        Living reference for tokens, primitives, and patterns used across Diary, Pain, therapy forms, and Memorable days.
        Examples use the same classes as production &mdash; edit <code>styles.css</code> and this page tracks it.
      </p>

      <div className="grid gap-8 mt-8 items-start wide:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] wide:gap-12">
        <div className="block min-w-0 [&>section+section]:mt-3">
          <EntriesHeading className="mb-5">Foundations</EntriesHeading>

          <section className="flex flex-col gap-3">
            <SectionHead title="Colors" aside="CSS custom properties" variant="ds" />
            <ul className="list-none m-0 p-0 grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
              {DESIGN_COLOR_TOKENS.map((t) => (
                <li key={t.varName} className="flex items-center gap-3 p-2 rounded-sm bg-card-soft">
                  <span className="w-[32px] h-[32px] rounded-[8px] flex-shrink-0" style={{ background: `var(${t.varName})` }} />
                  <div className="flex flex-col gap-[2px] min-w-0">
                    <span className="text-xs font-semibold text-text">{t.name}</span>
                    <code className="text-micro text-muted">{t.varName}</code>
                    <span className="text-micro text-muted-soft">{t.role}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHead title="Typography" aside="Manrope" variant="ds" />
            <dl className="m-0 flex flex-col gap-3">
              <div className="flex flex-col gap-[2px] py-[2px] [&_dt]:m-0 [&_dt]:min-w-0 [&_dd]:m-0 [&_dd]:text-micro [&_dd]:text-muted-soft">
                <dt style={{ font: "700 28px var(--font-body)" }}>Panel title</dt>
                <dd>28 / 700</dd>
              </div>
              <div className="flex flex-col gap-[2px] py-[2px] [&_dt]:m-0 [&_dt]:min-w-0 [&_dd]:m-0 [&_dd]:text-micro [&_dd]:text-muted-soft">
                <dt style={{ font: "700 10px var(--font-body)", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted)" }}>
                  Entries heading
                </dt>
                <dd>10 / 700 / 0.16em</dd>
              </div>
              <div className="flex flex-col gap-[2px] py-[2px] [&_dt]:m-0 [&_dt]:min-w-0 [&_dd]:m-0 [&_dd]:text-micro [&_dd]:text-muted-soft">
                <dt style={{ font: "500 14px var(--font-body)" }}>Body</dt>
                <dd>14 / 500</dd>
              </div>
              <div className="flex flex-col gap-[2px] py-[2px] [&_dt]:m-0 [&_dt]:min-w-0 [&_dd]:m-0 [&_dd]:text-micro [&_dd]:text-muted-soft">
                <dt style={{ font: "500 12px var(--font-body)", color: "var(--muted)" }}>Hint</dt>
                <dd>12 / 500 / muted</dd>
              </div>
              <div className="flex flex-col gap-[2px] py-[2px] [&_dt]:m-0 [&_dt]:min-w-0 [&_dd]:m-0 [&_dd]:text-micro [&_dd]:text-muted-soft">
                <dt style={{ font: "500 12px var(--font-mono, ui-monospace, Menlo, monospace)", fontVariantNumeric: "tabular-nums", color: "var(--muted)" }}>
                  Entry date · Apr 18, 5:03 PM
                </dt>
                <dd>12 / mono / tabular</dd>
              </div>
            </dl>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHead title="Badges" aside="9-point scale" variant="ds" />
            <div className="flex gap-2 flex-wrap">
              <PainBadge variant="low" sm>2</PainBadge>
              <PainBadge variant="mid" sm>5</PainBadge>
              <PainBadge variant="high" sm>8</PainBadge>
              <PainBadge variant="muted" sm>&mdash;</PainBadge>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHead title="Elevation" aside="Shadows + focus ring" variant="ds" />
            <ul className="list-none m-0 p-0 flex flex-wrap gap-5">
              <li className="flex flex-col items-center gap-2 text-micro text-muted">
                <span className="w-[72px] h-[48px] rounded-md bg-card-strong shadow-[var(--shadow-sm)]" />
                <code>--shadow-sm</code>
              </li>
              <li className="flex flex-col items-center gap-2 text-micro text-muted">
                <span className="w-[72px] h-[48px] rounded-md bg-card-strong shadow-[var(--shadow)]" />
                <code>--shadow</code>
              </li>
              <li className="flex flex-col items-center gap-2 text-micro text-muted">
                <span className="w-[72px] h-[48px] rounded-md bg-card-strong shadow-[0_0_0_2px_var(--ring)]" />
                <code>--ring</code>
              </li>
            </ul>
            <p className="m-0 text-micro text-muted-soft leading-snug [&_code]:text-muted">
              Keyboard focus uses <code>focus-visible:shadow-[0_0_0_2px_var(--ring)]</code> across buttons, inputs, and pills.
            </p>
          </section>
        </div>

        <div className="block min-w-0 [&>section+section]:mt-3 wide:border-l wide:border-border wide:pl-12">
          <EntriesHeading className="mb-5">Components</EntriesHeading>

          <section className="flex flex-col gap-3">
            <SectionHead title="Buttons" aside="Pill utility" variant="ds" />
            <div className="flex gap-2 flex-wrap">
              <Button>Default</Button>
              <Button variant="primary">Primary</Button>
              <Button variant="success">✓ Saved</Button>
              <Button variant="danger">Danger</Button>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHead title="Switch" aside="On / off" variant="ds" />
            <div className="flex gap-4 items-center flex-wrap">
              <label className="inline-flex items-center gap-2 text-control text-text">
                <Switch defaultChecked /> On
              </label>
              <label className="inline-flex items-center gap-2 text-control text-text">
                <Switch /> Off
              </label>
              <label className="inline-flex items-center gap-2 text-control text-muted">
                <Switch size="sm" defaultChecked /> Small
              </label>
              <label className="inline-flex items-center gap-2 text-control text-muted">
                <Switch disabled /> Disabled
              </label>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHead title="Sidebar nav" aside=".sidebar-item" variant="ds" />
            <p className="m-0 text-micro text-muted-soft leading-snug [&_code]:text-muted">
              Uses production classes. Default → hover <code>card-strong</code>; <code>active</code> → accent tint.
            </p>
            <div className="max-w-[220px] flex flex-col gap-3">
              <button type="button" className={`${NAV_ITEM} ${NAV_ITEM_IDLE}`} tabIndex={-1}>
                {DS_SIDEBAR_DEMO_ICON}
                <span className="opacity-100">Dashboard</span>
              </button>
              <button type="button" className={`${NAV_ITEM} ${NAV_ITEM_ACTIVE}`} tabIndex={-1}>
                {DS_SIDEBAR_DEMO_ICON}
                <span className="opacity-100">Settings</span>
              </button>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHead title="Form fields" aside="Field-line" variant="ds" />
            <div className="flex flex-col gap-3">
              <FieldLine label="Text" type="text" defaultValue="Sample value" aria-label="Text" />
              <FieldLine label="Date & time" id="ds-datetime" name="ds-datetime" type="datetime-local" defaultValue="2026-04-18T17:30" aria-label="Date/time" className={DATE_TIME_INPUT} />
              <FieldLine label="Description" multiline rows={2} placeholder="Free text area…" aria-label="Description" />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHead title="Metrics" aside="StageScale · StageStepper" variant="ds" />
            <div className="flex flex-col gap-5">
              <StageField label="Mood">
                <StageScale label="Mood" value={moodDemo} higherIsBetter onChange={setMoodDemo} ends={["heavy", "okay", "great"]} />
              </StageField>
              <StageField label="Pain">
                <StageScale label="Pain" value={painDemo} onChange={setPainDemo} ends={["mild", "moderate", "severe"]} />
              </StageField>
              <StageField label="Coffee">
                <StageStepper label="coffee" value={coffeeDemo} onChange={setCoffeeDemo} />
              </StageField>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHead title="Stage" aside="StageHead · StageField" variant="ds" />
            <div className={STAGE}>
              <StageHead step={1} title="How bad is it?" aside="optional" />
              <StageField label="Situation" prompt="The prompt is a line, not a placeholder: it has to survive being answered." htmlFor="ds-situation">
                <input id="ds-situation" name="ds-situation" type="text" className={FIELD_LINE_INPUT} readOnly value="Started after the meeting" />
              </StageField>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHead title="Tabs" aside="Underline, accent" variant="ds" />
            <TagTabs
              tabs={(["positive", "negative", "general"] as const).map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1), count: 0 }))}
              active={tabDemo}
              onSelect={setTabDemo}
              ariaLabel="Demo tabs"
            />
          </section>

          <section className="flex flex-col gap-3">
            <SectionHead title="Entry row" aside="Collapsible details" variant="ds" />
            <details className={ENTRY_ROW} open>
              <summary className={ENTRY_SUMMARY}>
                <span className={ENTRY_DATE}>Apr 18, 5:03 PM</span>
                <PainBadge variant="mid" sm>6</PainBadge>
                <span className={ENTRY_PREVIEW}>grateful · distracted, restless</span>
                <span />
                <span className={ENTRY_CHEVRON} aria-hidden="true">▶</span>
              </summary>
              <div className={ENTRY_EXPANDED}>
                <DetailGroup label="Mood · Dep · Anx">6 · 4 · 4</DetailGroup>
                <DetailGroup label="Positive"><span className={TAG_MINI}>grateful</span></DetailGroup>
              </div>
            </details>
          </section>

          <section className="flex flex-col gap-3">
            <SectionHead title="Memorable days" aside="Calendar · list · emoji" variant="ds" />
            <div className="flex flex-col gap-3 items-stretch">
              <div className="flex items-center">
                <div className="flex gap-2 items-center">
                  <Button className="flex-shrink-0 tracking-[0.01em]">Prev</Button>
                  <Button className="tracking-[0.01em] min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap" aria-label="Go to current month (demo)">May 2026</Button>
                  <Button className="flex-shrink-0 tracking-[0.01em]">Next</Button>
                </div>
              </div>
              <Button variant="primary">Add new</Button>
              <div className="flex items-center gap-2 mb-2">
                {DS_MEMORABLE_WEEKDAY_LABELS.map((d) => (
                  <span key={d} className="flex-1 text-center text-muted text-xs font-bold uppercase">{d}</span>
                ))}
              </div>
              <div className="max-w-[480px] w-full">
                <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] gap-2">
                  {[
                    { n: 27, mod: "opacity-[0.48]" },
                    { n: 28, mod: "shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_28%,transparent)]" },
                    { n: 29, marker: "Team lunch" },
                    { n: 30 }, { n: 1 }, { n: 2 }, { n: 3 },
                  ].map((cell) => (
                    <div key={cell.n} className={`${MEMO_DAY_CELL} !min-h-[72px] !p-2 ${cell.mod ?? ""}`}>
                      <span className="flex items-center justify-between">
                        <button type="button" className={DAY_NUMBER} tabIndex={-1} onClick={(e) => e.preventDefault()}>{cell.n}</button>
                      </span>
                      {cell.marker ? (
                        <span className="flex flex-col gap-2">
                          <span className="text-xs leading-snug text-muted whitespace-nowrap overflow-hidden text-ellipsis">{cell.marker}</span>
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
              <button type="button" className={MEMO_LIST_ITEM}>
                <span className="text-title leading-none">🎂</span>
                <span className="flex-1 flex flex-col gap-1 items-start">
                  <span className="w-full flex items-baseline justify-between gap-3">
                    <strong className="text-base min-w-0 text-text">Sample day</strong>
                    <span className="text-muted text-control flex-shrink-0 text-right">05-15</span>
                  </span>
                  <span className="text-micro text-muted-soft">yearly</span>
                </span>
              </button>
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" className={EMOJI_TRIGGER} aria-label="Emoji picker trigger demo">
                  <span className="text-[32px] leading-none" aria-hidden>✨</span>
                </button>
                <p className="m-0 text-micro text-muted">Same trigger class as the modal emoji control.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
