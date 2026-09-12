import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiEnvelopeSchema, apiFetch } from "../lib";
import { parseStatement, StatementError, type ParsedStatement } from "../app/money/pdf-import";
import {
  freshTxDefaults,
  tipoShowsBuyValue,
  tipoShowsPnl,
  transactionListSchema,
  txFormSchema,
  type Transaction,
  type TxFormValues,
} from "../app/money/core";

const okSchema = apiEnvelopeSchema(z.object({ ok: z.boolean() }));
const importedSchema = apiEnvelopeSchema(
  z.object({ inserted: z.number(), skipped: z.number(), deleted: z.number() }),
);

/** A statement read and checked against the rows already on the account. */
export type StatementPreview = {
  parsed: ParsedStatement;
  existingInPeriod: number;
  revaluationsInPeriod: number;
  /** Whether the ledger already accounts for what the account held before the period. */
  hasEarlierRows: boolean;
};

// Revolut's own statements are well under a megabyte; anything this large is
// not one of them, and parsing it would freeze the tab before saying so.
const MAX_STATEMENT_BYTES = 20 * 1024 * 1024;

// The server's own maximum page size. The overlap warning has to see every row
// in the imported period, not just the page the history list happens to hold.
const OVERLAP_SCAN_LIMIT = 5000;
const createdSchema = apiEnvelopeSchema(z.object({ id: z.string() }));

function buildPayload(values: TxFormValues) {
  const parsed = txFormSchema.parse(values);
  // Whichever amount field the tipo hides is submitted as 0, so switching
  // tipo mid-edit can't smuggle a stale value through.
  const buyValue = tipoShowsBuyValue(parsed.tipo) ? parsed.buyValue : 0;
  const pnl = tipoShowsPnl(parsed.tipo) ? parsed.pnl : 0;
  return {
    txDate: parsed.txDate,
    asset: parsed.asset,
    tipo: parsed.tipo,
    buyValue,
    pnl,
    currentValue: buyValue + pnl,
    note: parsed.note,
  };
}

export function useMoneyTransactions(enabled: boolean) {
  const queryClient = useQueryClient();
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [replace, setReplace] = useState(false);
  const [reading, setReading] = useState(false);
  const [confirmDeleteTx, setConfirmDeleteTx] = useState<string | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(resetTimerRef.current), []);

  const txQuery = useQuery({
    queryKey: ["money-transactions"],
    enabled,
    queryFn: async () =>
      apiFetch("/api/v1/money/transactions", { method: "GET" }, (raw) => transactionListSchema.parse(raw).data),
  });

  const txForm = useForm<TxFormValues>({ defaultValues: freshTxDefaults() });

  const txMutation = useMutation({
    mutationFn: async (values: TxFormValues) => {
      const payload = buildPayload(values);
      if (editingTx) {
        return apiFetch(
          `/api/v1/money/transactions/${editingTx.id}`,
          { method: "PUT", body: JSON.stringify(payload) },
          (raw) => okSchema.parse(raw).data,
        );
      }
      return apiFetch(
        "/api/v1/money/transactions",
        { method: "POST", body: JSON.stringify(payload) },
        (raw) => createdSchema.parse(raw).data,
      );
    },
    onSuccess: async () => {
      setEditingTx(null);
      txForm.reset(freshTxDefaults());
      await queryClient.invalidateQueries({ queryKey: ["money-transactions"] });
      toast.success("Transaction saved");
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => txMutation.reset(), 3000);
    },
    onError: () => {
      toast.error("Couldn't save transaction. Try again.");
    },
  });

  const txDeleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiFetch(`/api/v1/money/transactions/${id}`, { method: "DELETE" }, (raw) => okSchema.parse(raw).data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["money-transactions"] });
    },
    onError: () => {
      toast.error("Couldn't delete transaction. Try again.");
    },
  });

  const importMutation = useMutation({
    mutationFn: async (payload: StatementPreview) => {
      const { parsed } = payload;
      return apiFetch(
        "/api/v1/money/transactions/import",
        {
          method: "POST",
          body: JSON.stringify({
            rows: parsed.rows,
            ...(replace ? { replace: { from: parsed.periodFrom, to: parsed.periodTo } } : {}),
          }),
        },
        (raw) => importedSchema.parse(raw).data,
      );
    },
    onSuccess: async (result) => {
      setPreview(null);
      setReplace(false);
      await queryClient.invalidateQueries({ queryKey: ["money-transactions"] });
      const parts = [`${result.inserted} imported`];
      if (result.deleted > 0) parts.push(`${result.deleted} replaced`);
      if (result.skipped > 0) parts.push(`${result.skipped} already present`);
      toast.success(parts.join(", "));
    },
    onError: () => {
      toast.error("Couldn't import the statement. Try again.");
    },
  });

  // Memoised, not just `?? []`: a fresh empty array on every render would
  // make the assetOptions memo below recompute forever.
  const transactions = useMemo(() => txQuery.data ?? [], [txQuery.data]);

  // Assets already used are offered as suggestions, so the same holding is
  // not re-typed three slightly different ways.
  const assetOptions = useMemo(
    () => Array.from(new Set(transactions.map((row) => row.asset).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [transactions],
  );

  // The PDF reader is a megabyte of parser that only a statement import needs,
  // so it is fetched on the first file rather than on every page load.
  const readStatement = async (file: File) => {
    if (file.size > MAX_STATEMENT_BYTES) {
      toast.error("That file is too large to be a Revolut statement.");
      return;
    }
    setReading(true);
    try {
      const reader = await import("../app/money/pdf-text").catch((cause: unknown) => {
        console.error("Failed to load the PDF reader:", cause);
        throw new StatementError("Couldn't load the PDF reader. Reload the page and try again.");
      });
      const parsed = parseStatement(await reader.extractPages(await file.arrayBuffer()));
      const all = await apiFetch(
        `/api/v1/money/transactions?limit=${OVERLAP_SCAN_LIMIT}`,
        { method: "GET" },
        (raw) => transactionListSchema.parse(raw).data,
      );
      const inPeriod = all.filter(
        (row) =>
          parsed.assets.includes(row.asset) &&
          row.txDate >= parsed.periodFrom &&
          row.txDate <= parsed.periodTo,
      );
      setPreview({
        parsed,
        existingInPeriod: inPeriod.length,
        revaluationsInPeriod: inPeriod.filter((row) => row.tipo === "Variazione Valore").length,
        hasEarlierRows: all.some(
          (row) => parsed.assets.includes(row.asset) && row.txDate < parsed.periodFrom,
        ),
      });
      // Keeping both sets double-counts the same money, so the safe option is
      // the preselected one and the user opts out of it.
      setReplace(inPeriod.length > 0);
    } catch (error) {
      if (error instanceof StatementError) {
        toast.error(error.message);
        return;
      }
      console.error("Failed to read statement:", error);
      toast.error("Couldn't read that PDF.");
    } finally {
      setReading(false);
    }
  };

  return {
    transactions,
    assetOptions,
    isLoading: txQuery.isLoading,
    txForm,
    txMutation,
    editingTx,
    confirmDeleteTx,
    resetTxForm: () => {
      setEditingTx(null);
      txForm.reset(freshTxDefaults());
    },
    startTxEdit: (row: Transaction) => {
      setEditingTx(row);
      txForm.reset({
        txDate: row.txDate,
        asset: row.asset,
        tipo: row.tipo,
        buyValue: row.buyValue,
        pnl: row.pnl,
        note: row.note,
      });
    },
    onDeleteClick: (id: string) => {
      if (confirmDeleteTx === id) {
        txDeleteMutation.mutate(id);
        setConfirmDeleteTx(null);
      } else {
        setConfirmDeleteTx(id);
      }
    },
    onDeleteBlur: () => setConfirmDeleteTx(null),
    statementImport: {
      reading,
      preview,
      replace,
      isSaving: importMutation.isPending,
      onSetReplace: setReplace,
      onPickFile: readStatement,
      onCancel: () => {
        setPreview(null);
        setReplace(false);
      },
      onConfirm: () => {
        if (preview) importMutation.mutate(preview);
      },
    },
  };
}
