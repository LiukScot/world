import { useId, type ReactNode } from "react";
import { Button, buttonClass } from "../../components/ui/Button";
import { InlineFeedback } from "../shared";
import { formatCurrency, formatTxDate } from "./core";
import type { StatementPreview } from "../../hooks/use-money-transactions";

const SOURCE_LABELS: Record<StatementPreview["parsed"]["source"], string> = {
  "revolut-robo": "Revolut robo-advisor",
  "revolut-savings": "Revolut savings account",
  cherrybank: "Cherry Bank account",
};

/**
 * The bank's own mark, from the simple-icons set. One path and no colour of its
 * own, so it takes the text colour around it and needs no dark-mode counterpart.
 */
function Mark({ viewBox, children }: { viewBox: string; children: ReactNode }) {
  return (
    <svg viewBox={viewBox} className="w-5 h-5 flex-shrink-0 fill-current" aria-hidden="true">
      {children}
    </svg>
  );
}

function RevolutMark() {
  return (
    <Mark viewBox="0 0 24 24">
      <path d="M20.9133 6.9566C20.9133 3.1208 17.7898 0 13.9503 0H2.424v3.8605h10.9782c1.7376 0 3.177 1.3651 3.2087 3.043.016.84-.2994 1.633-.8878 2.2324-.5886.5998-1.375.9303-2.2144.9303H9.2322a.2756.2756 0 0 0-.2755.2752v3.431c0 .0585.018.1142.052.1612L16.2646 24h5.3114l-7.2727-10.094c3.6625-.1838 6.61-3.2612 6.61-6.9494zM6.8943 5.9229H2.424V24h4.4704z" />
    </Mark>
  );
}

/**
 * The cherry of Cherry Bank's own logo, taken from the wordmark they publish
 * and cropped to the symbol: the speed lines beside it and the lettering under
 * it turn to mush at this size.
 */
function CherryMark() {
  return (
    <Mark viewBox="13 0 29 48">
      <path d="M40.6964 30.8069C39.9875 28.5178 38.6909 26.5096 36.92 24.9321C39.2449 21.5749 40.4757 17.6433 40.4834 13.5374C40.4923 8.72833 38.7766 4.07167 35.6531 0.42517C35.4073 0.137683 35.051 -0.0189602 34.6705 0.0018378C34.2927 0.0202665 33.9514 0.208765 33.7339 0.519156C30.6193 4.96836 25.7381 7.70396 20.3422 8.02435C20.018 8.04357 19.7204 8.18811 19.5048 8.43137C19.2889 8.67436 19.1806 8.98738 19.2 9.31199C19.2395 9.982 19.8174 10.4906 20.4861 10.4554C26.0405 10.1257 31.2065 7.49229 34.7446 3.20684C36.8866 6.1986 38.0575 9.84458 38.0506 13.5327C38.0441 17.1168 36.9747 20.5474 34.9592 23.4834C32.9253 22.2515 30.6193 21.6039 28.2229 21.6039C25.0755 21.6039 22.0379 22.7328 19.6702 24.7823C18.925 25.4271 18.2503 26.1603 17.6647 26.9614C13.4061 32.7848 14.6735 40.9911 20.4897 45.255C22.7466 46.9093 25.4136 47.7839 28.2024 47.7839C32.3603 47.7839 36.3073 45.781 38.7606 42.4264C41.1952 39.0972 41.9188 34.7535 40.6961 30.8072L40.6964 30.8069ZM38.724 36.366C38.459 38.048 37.8111 39.6029 36.7982 40.9877C35.7788 42.3819 34.4841 43.4753 32.9503 44.2366C31.4849 44.9641 29.8431 45.3487 28.2026 45.3487C25.934 45.3487 23.7639 44.6368 21.9267 43.2902C17.193 39.8198 16.1612 33.1402 19.6273 28.4006C20.1053 27.747 20.6549 27.1496 21.261 26.6252C23.187 24.9579 25.6597 24.0396 28.2231 24.0396C30.4918 24.0396 32.6619 24.7515 34.4988 26.0981C36.3544 27.4584 37.6941 29.3363 38.3733 31.5285C38.8558 33.0873 38.9772 34.7601 38.724 36.3663V36.366Z" />
    </Mark>
  );
}

const SUPPORTED_BANKS = [
  {
    bank: "Revolut",
    mark: RevolutMark,
    statements: ["Robo-advisor account statement", "Savings account statement"],
  },
  {
    bank: "Cherry Bank",
    mark: CherryMark,
    statements: ["Account statement, covering the current account and its time deposits"],
  },
];

/** What the import can read, so nobody has to guess which file to export. */
export function SupportedStatements() {
  return (
    <div className="grid gap-4">
      {SUPPORTED_BANKS.map(({ bank, mark: Mark, statements }) => (
        <div key={bank} className="flex gap-3 items-start min-w-0">
          <span className="text-text mt-[2px]">
            <Mark />
          </span>
          <div className="grid gap-1 min-w-0">
            <span className="text-control font-bold text-text">{bank}</span>
            <ul className="m-0 p-0 list-none grid gap-[2px] text-hint text-muted">
              {statements.map((statement) => (
                <li key={statement}>{statement}</li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatementImportButton({
  reading,
  onPickFile,
}: {
  reading: boolean;
  onPickFile: (file: File) => void;
}) {
  const inputId = useId();
  return (
    // The input itself is transparent and covers the pill, so the focus ring
    // has to be drawn by the label a keyboard user is really focusing.
    <label
      htmlFor={inputId}
      className={`${buttonClass("primary")} relative overflow-hidden cursor-pointer focus-within:shadow-[0_0_0_2px_var(--ring)]`}
    >
      {reading ? "Reading..." : "Import statement"}
      <input
        id={inputId}
        name="statement"
        type="file"
        accept="application/pdf,.pdf"
        aria-label="Import a PDF bank statement"
        disabled={reading}
        className="absolute inset-0 opacity-0 cursor-pointer"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPickFile(file);
          // Cleared so picking the same file again still fires a change.
          e.target.value = "";
        }}
      />
    </label>
  );
}

export function StatementImportPreview({
  preview,
  replace,
  isSaving,
  onSetReplace,
  onCancel,
  onConfirm,
}: {
  preview: StatementPreview;
  replace: boolean;
  isSaving: boolean;
  onSetReplace: (next: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const replaceId = useId();
  const { parsed, existingInPeriod, revaluationsInPeriod, hasEarlierRows } = preview;
  // A statement covers its period and nothing before it. If the ledger holds no
  // earlier history either, that opening money is in no row on either side and
  // the asset ends up short by exactly it.
  const unaccountedOpening = parsed.openingBalance !== 0 && !hasEarlierRows;

  return (
    <section className="grid gap-5 min-w-0" aria-label="Statement import preview">
      <div className="grid gap-1">
        <h2 className="m-0 text-base font-bold text-text">{SOURCE_LABELS[parsed.source]}</h2>
        <p className="m-0 text-control text-muted">
          {formatTxDate(parsed.periodFrom)} to {formatTxDate(parsed.periodTo)} · {parsed.rows.length}{" "}
          {parsed.rows.length === 1 ? "row" : "rows"} to import
        </p>
      </div>

      <div className="grid gap-1 p-3 rounded-md bg-card-soft min-w-0 overflow-x-auto">
        {parsed.rows.map((row) => (
          <div
            key={`${row.txDate}-${row.tipo}-${row.buyValue}-${row.pnl}`}
            className="grid grid-cols-[auto_1fr_auto] gap-3 items-baseline py-1 text-control"
          >
            <span className="text-muted tabular-nums">{formatTxDate(row.txDate)}</span>
            <span className="text-text truncate">{row.tipo}</span>
            <span
              className={
                row.buyValue + row.pnl > 0 ? "text-success" : row.buyValue + row.pnl < 0 ? "text-danger" : "text-muted"
              }
            >
              {formatCurrency(row.buyValue + row.pnl)}
            </span>
          </div>
        ))}
      </div>

      {parsed.skipped.length > 0 && (
        <ul className="m-0 pl-4 grid gap-1 text-hint text-muted">
          {parsed.skipped.map((group) => (
            <li key={group.reason}>
              {group.count} {group.reason}
            </li>
          ))}
        </ul>
      )}

      {unaccountedOpening && (
        <InlineFeedback
          message={{
            tone: "error",
            text: `This statement opens at ${formatCurrency(parsed.openingBalance)} that none of its rows account for, and the ledger holds nothing for ${parsed.assets.join(" and ")} before ${formatTxDate(parsed.periodFrom)}. Importing it leaves the asset short by that much. Export a statement starting before the account held any money.`,
          }}
        />
      )}

      {existingInPeriod > 0 && (
        <div className="grid gap-2">
          <InlineFeedback
            message={{
              tone: "warning",
              text: `This period already holds ${existingInPeriod} ${
                existingInPeriod === 1 ? "transaction" : "transactions"
              } for ${parsed.assets.join(" and ")}. Monthly sums do not line up with rows entered by hand, so keeping both counts the same money twice.`,
            }}
          />
          <label htmlFor={replaceId} className="flex items-center gap-2 text-control text-text cursor-pointer">
            <input
              id={replaceId}
              name="replace-period"
              type="checkbox"
              checked={replace}
              onChange={(e) => onSetReplace(e.target.checked)}
            />
            Delete those {existingInPeriod} rows first
          </label>
          {replace && revaluationsInPeriod > 0 && (
            <InlineFeedback
              message={{
                tone: "error",
                text: `${revaluationsInPeriod} of them ${
                  revaluationsInPeriod === 1 ? "is a" : "are"
                } Variazione Valore row${revaluationsInPeriod === 1 ? "" : "s"}. No statement can reproduce those at monthly detail: the import replaces them with one revaluation for the whole period.`,
              }}
            />
          )}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="button" variant="primary" onClick={onConfirm} disabled={isSaving || unaccountedOpening}>
          {isSaving ? "Importing..." : `Import ${parsed.rows.length}`}
        </Button>
      </div>
    </section>
  );
}
