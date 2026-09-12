import { useId } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { Button } from "../../components/ui/Button";
import { DATE_TIME_INPUT } from "../../components/ui/DateInput";
import { FieldLine, FIELD_LINE_LABEL } from "../../components/ui/FieldLine";
import { Select } from "../../components/ui/select";
import { AnimatedEditingLabel } from "../shared";
import { EmptyState, PAGE, PAGE_TITLE } from "../screen-helpers";
import { entryViewLabels } from "../core";
import { FLAT_ACTIONS, FLAT_FORM, FLAT_ROW, FLAT_SHELL } from "../staged";
import {
  DELETE_CONFIRM,
  DETAIL_ACTIONS,
  DETAIL_ACTION_BTN,
  DetailGroup,
  ENTRY_CHEVRON,
  ENTRY_DATE,
  ENTRY_EXPANDED,
  ENTRY_PREVIEW,
  ENTRY_ROW,
  ENTRY_SUMMARY,
  EntriesHeading,
  PainBadge,
  PastEntries,
  EntryMonths,
  EntryViewTabs,
  type EntryView,
} from "../entries";
import { StatementImportButton, StatementImportPreview, SupportedStatements } from "./StatementImport";
import type { StatementPreview } from "../../hooks/use-money-transactions";
import {
  formatCurrency,
  formatTxDate,
  TIPO_OPTIONS,
  tipoShowsBuyValue,
  type Transaction,
  type TxFormValues,
} from "./core";

const TIPO_SELECT_OPTIONS = TIPO_OPTIONS.map((tipo) => ({ value: tipo, label: tipo }));

export function TransactionsSection({
  txForm,
  txMutationState,
  isLoading,
  editingTx,
  transactions,
  assetOptions,
  confirmDeleteTx,
  onSubmit,
  onCancelEdit,
  onStartEdit,
  onDeleteClick,
  onDeleteBlur,
  view,
  onViewChange,
  statementImport,
}: {
  txForm: UseFormReturn<TxFormValues>;
  txMutationState: { isSuccess: boolean };
  isLoading: boolean;
  editingTx: Transaction | null;
  transactions: Transaction[];
  assetOptions: string[];
  confirmDeleteTx: string | null;
  onSubmit: (values: TxFormValues) => void;
  onCancelEdit: () => void;
  onStartEdit: (row: Transaction) => void;
  onDeleteClick: (id: string) => void;
  onDeleteBlur: () => void;
  view: EntryView;
  onViewChange: (next: EntryView) => void;
  statementImport: {
    reading: boolean;
    preview: StatementPreview | null;
    replace: boolean;
    isSaving: boolean;
    onSetReplace: (next: boolean) => void;
    onPickFile: (file: File) => void;
    onCancel: () => void;
    onConfirm: () => void;
  };
}) {
  const assetListId = useId();
  const watchedTipo = txForm.watch("tipo");
  const showBuyValue = tipoShowsBuyValue(watchedTipo);


  return (
    <section className={PAGE}>
      <EntryViewTabs view={view} onChange={onViewChange} labels={entryViewLabels["money-transactions"]} className="inline-flex max-mobile:hidden" />
      <h1 className={PAGE_TITLE}>Transactions</h1>
      {view === "new" && statementImport.preview ? (
      <StatementImportPreview
        preview={statementImport.preview}
        replace={statementImport.replace}
        isSaving={statementImport.isSaving}
        onSetReplace={statementImport.onSetReplace}
        onCancel={statementImport.onCancel}
        onConfirm={statementImport.onConfirm}
      />
      ) : view === "new" ? (
      // Two ways to add a transaction, side by side once there is room for
      // both. The form gets the wider half because it holds the fields, and
      // each half is its own container so those fields measure the half they
      // sit in rather than the whole page.
      <div className="grid gap-page items-start min-w-0 xwide:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className={`@container ${FLAT_SHELL}`}>
      <EntriesHeading>Add manually</EntriesHeading>
      <form onSubmit={txForm.handleSubmit(onSubmit)} className={FLAT_SHELL}>
        <div className={FLAT_FORM}>
        <div className={FLAT_ROW}>
          <FieldLine
            label="Date"
            id="tx-date"
            type="date"
            aria-label="Date"
            className={DATE_TIME_INPUT}
            {...txForm.register("txDate")}
            onClick={(e) => {
              const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
              el.showPicker?.();
            }}
          />
          {/* Native datalist: type a new asset or pick one already used.
              No combobox library needed, and it stays keyboard-native. */}
          <FieldLine
            label="Asset"
            type="text"
            list={assetListId}
            autoComplete="off"
            placeholder={assetOptions.length > 0 ? "Type or pick one" : "e.g. revolut"}
            aria-label="Asset"
            {...txForm.register("asset")}
          />
          <datalist id={assetListId}>
            {assetOptions.map((asset) => (
              <option key={asset} value={asset} />
            ))}
          </datalist>
        </div>

        <div className={FLAT_ROW}>
          {/* A <span>, not a <label>: the Select is a button + popover, and
              wrapping those in a label makes every click toggle it twice. */}
          <div className="grid gap-2 content-start">
            <span className={FIELD_LINE_LABEL}>Type</span>
            <Controller
              control={txForm.control}
              name="tipo"
              render={({ field }) => (
                <Select
                  ariaLabel="Type"
                  value={field.value}
                  onValueChange={field.onChange}
                  options={TIPO_SELECT_OPTIONS}
                />
              )}
            />
          </div>

          {/* Buy value only exists for the tipo that books money in; the
              others record a return on money already there. */}
          {showBuyValue ? (
            <FieldLine
              label="Buy value"
              type="number"
              step="0.01"
              placeholder="0"
              aria-label="Buy value"
              {...txForm.register("buyValue")}
            />
          ) : (
            <FieldLine
              label="PnL"
              type="number"
              step="0.01"
              placeholder="0"
              aria-label="PnL"
              {...txForm.register("pnl")}
            />
          )}
        </div>

        <FieldLine
          label="Note"
          multiline
          compact
          rows={2}
          placeholder="Anything worth remembering about this move."
          aria-label="Note"
          {...txForm.register("note")}
        />

        </div>

        <div className={FLAT_ACTIONS}>
          <Button type="submit" variant={txMutationState.isSuccess ? "success" : "primary"}>
            {txMutationState.isSuccess ? "✓ Saved" : editingTx ? "Update transaction" : "Save transaction"}
          </Button>
        </div>
      </form>
      </div>

      <div className={`@container ${FLAT_SHELL}`}>
        <EntriesHeading>Import from PDF</EntriesHeading>
        <div className={FLAT_FORM}>
          <SupportedStatements />
          <p className="m-0 text-hint text-muted max-w-[60ch]">
            Nothing is written until you have seen what the file contains.
          </p>
        </div>
        <div className={FLAT_ACTIONS}>
          <StatementImportButton reading={statementImport.reading} onPickFile={statementImport.onPickFile} />
        </div>
      </div>
      </div>
      ) : (

      <PastEntries
        title="History"
        isLoading={isLoading}
        loadingText="Loading transactions..."
        isEmpty={transactions.length === 0}
        emptyState={
          <EmptyState
            title="No transactions yet"
            description="Record a purchase, a coupon or a revaluation with the form. Everything you log shows up here, newest first."
          />
        }
      >
        <EntryMonths
          rows={transactions}
          dateOf={(row) => row.txDate}
          renderRow={(row) => {
          const gain = row.pnl > 0;
          const loss = row.pnl < 0;
          return (
            <details key={row.id} className={ENTRY_ROW}>
              <summary className={ENTRY_SUMMARY}>
                <span className={ENTRY_DATE}>{formatTxDate(row.txDate)}</span>
                <PainBadge variant="muted" sm>{row.tipo}</PainBadge>
                <span className={ENTRY_PREVIEW}>{row.asset || "—"}</span>
                {/* Sign and value carry the meaning; colour only reinforces it. */}
                <span className={gain ? "text-success" : loss ? "text-danger" : "text-muted"}>
                  {formatCurrency(row.currentValue)}
                </span>
                <span className={ENTRY_CHEVRON} aria-hidden="true">▶</span>
              </summary>
              <div className={ENTRY_EXPANDED}>
                <DetailGroup label="Buy value">{formatCurrency(row.buyValue)}</DetailGroup>
                <DetailGroup label="PnL">{formatCurrency(row.pnl)}</DetailGroup>
                <DetailGroup label="Current value">{formatCurrency(row.currentValue)}</DetailGroup>
                <DetailGroup label="Type">{row.derivedType || "—"}</DetailGroup>
                <DetailGroup label="Note">{row.note || "—"}</DetailGroup>
                <div className={DETAIL_ACTIONS}>
                  <button
                    type="button"
                    className={DETAIL_ACTION_BTN}
                    onClick={() => {
                      if (editingTx?.id === row.id) {
                        onCancelEdit();
                        return;
                      }
                      onStartEdit(row);
                      // Editing means going back to the form, which the log view is not
                      // showing: filling a form nobody can see is not an edit.
                      onViewChange("new");
                    }}
                  >
                    <AnimatedEditingLabel active={editingTx?.id === row.id} />
                  </button>
                  <button
                    type="button"
                    className={`${DETAIL_ACTION_BTN} ${confirmDeleteTx === row.id ? DELETE_CONFIRM : ""}`}
                    onClick={() => onDeleteClick(row.id)}
                    onBlur={onDeleteBlur}
                  >
                    {confirmDeleteTx === row.id ? "Delete?" : "Delete"}
                  </button>
                </div>
              </div>
            </details>
          );
        }}
        />
      </PastEntries>
      )}
    </section>
  );
}
