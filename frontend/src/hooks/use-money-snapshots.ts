import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiEnvelopeSchema, apiFetch } from "../lib";
import {
  assetsWithoutRisk,
  computeRiskTotals,
  freshSnapshotDefaults,
  snapshotFormSchema,
  snapshotListSchema,
  stylesMapSchema,
  transactionListSchema,
  type Snapshot,
  type SnapshotFormValues,
} from "../app/money/core";

const okSchema = apiEnvelopeSchema(z.object({ ok: z.boolean() }));
const createdSchema = apiEnvelopeSchema(z.object({ id: z.string() }));

export function useMoneySnapshots(enabled: boolean) {
  const queryClient = useQueryClient();
  const [confirmDeleteSnapshot, setConfirmDeleteSnapshot] = useState<string | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(resetTimerRef.current), []);

  const snapshotsQuery = useQuery({
    queryKey: ["money-snapshots"],
    enabled,
    queryFn: async () =>
      apiFetch("/api/v1/money/monthly-snapshots", { method: "GET" }, (raw) => snapshotListSchema.parse(raw).data),
  });

  // A snapshot's risk buckets are derived, so both of these have to be loaded
  // before one can be saved. The transactions key is shared with
  // useMoneyTransactions, so opening this panel after that one costs no
  // second request.
  const transactionsQuery = useQuery({
    queryKey: ["money-transactions"],
    enabled,
    queryFn: async () =>
      apiFetch("/api/v1/money/transactions", { method: "GET" }, (raw) => transactionListSchema.parse(raw).data),
  });

  const stylesQuery = useQuery({
    queryKey: ["money-styles"],
    enabled,
    queryFn: async () =>
      apiFetch("/api/v1/money/assets/styles", { method: "GET" }, (raw) => stylesMapSchema.parse(raw).data),
  });

  const snapshotForm = useForm<SnapshotFormValues>({ defaultValues: freshSnapshotDefaults() });

  const canSave = transactionsQuery.isSuccess && stylesQuery.isSuccess;

  // A snapshot splits the portfolio across the three risk buckets, so an asset
  // with no risk level would be dropped from the total without saying so.
  const assetsMissingRisk =
    transactionsQuery.data && stylesQuery.data
      ? assetsWithoutRisk(transactionsQuery.data, stylesQuery.data)
      : [];

  const snapshotMutation = useMutation({
    mutationFn: async (values: SnapshotFormValues) => {
      const form = snapshotFormSchema.parse(values);
      const transactions = transactionsQuery.data;
      const styles = stylesQuery.data;
      if (!transactions || !styles) {
        throw new Error("Transactions and asset styles must load before a snapshot can be taken.");
      }
      const totals = computeRiskTotals(transactions, styles);
      return apiFetch(
        "/api/v1/money/monthly-snapshots",
        {
          method: "POST",
          body: JSON.stringify({
            snapshotDate: form.snapshotDate,
            lowRisk: totals.low,
            mediumRisk: totals.medium,
            highRisk: totals.high,
            liquid: form.liquid,
          }),
        },
        (raw) => createdSchema.parse(raw).data,
      );
    },
    onSuccess: async () => {
      snapshotForm.reset(freshSnapshotDefaults());
      await queryClient.invalidateQueries({ queryKey: ["money-snapshots"] });
      toast.success("Snapshot taken");
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => snapshotMutation.reset(), 3000);
    },
    onError: () => {
      toast.error("Couldn't take snapshot. Try again.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiFetch(`/api/v1/money/monthly-snapshots/${id}`, { method: "DELETE" }, (raw) => okSchema.parse(raw).data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["money-snapshots"] });
    },
    onError: () => {
      toast.error("Couldn't delete snapshot. Try again.");
    },
  });

  return {
    snapshots: (snapshotsQuery.data ?? []) as Snapshot[],
    isLoading: snapshotsQuery.isLoading,
    canSave,
    assetsMissingRisk,
    snapshotForm,
    snapshotMutation,
    confirmDeleteSnapshot,
    onDeleteClick: (id: string) => {
      if (confirmDeleteSnapshot === id) {
        deleteMutation.mutate(id);
        setConfirmDeleteSnapshot(null);
      } else {
        setConfirmDeleteSnapshot(id);
      }
    },
    onDeleteBlur: () => setConfirmDeleteSnapshot(null),
  };
}
