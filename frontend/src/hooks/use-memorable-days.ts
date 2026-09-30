import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { apiEnvelopeSchema, apiFetch, getErrorMessage } from "../lib";
import { memorableDayListSchema } from "../app/core";

type MemorableDayPayload = {
  date: string;
  title: string;
  emoji: string;
  description: string;
};

function todayKey() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function useMemorableDays(enabled: boolean) {
  const queryClient = useQueryClient();
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const today = todayKey();
  const memorableDaysQuery = useQuery({
    queryKey: ["memorable-days", today],
    enabled,
    queryFn: async () =>
      apiFetch("/api/v1/memorable-days", { method: "GET" }, (raw) => memorableDayListSchema.parse(raw).data),
  });

  const mutationParser = (raw: unknown) => apiEnvelopeSchema(z.object({ ok: z.boolean().optional(), id: z.number().optional() })).parse(raw).data;

  const createMutation = useMutation({
    mutationFn: async (payload: MemorableDayPayload) =>
      apiFetch("/api/v1/memorable-days", { method: "POST", body: JSON.stringify(payload) }, mutationParser),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["memorable-days"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: MemorableDayPayload }) =>
      apiFetch(`/api/v1/memorable-days/${id}`, { method: "PUT", body: JSON.stringify(payload) }, mutationParser),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["memorable-days"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) =>
      apiFetch(`/api/v1/memorable-days/${id}`, { method: "DELETE" }, mutationParser),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["memorable-days"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const sortedItems = useMemo(
    () => [...(memorableDaysQuery.data ?? [])].sort((left, right) => right.date.localeCompare(left.date) || left.title.localeCompare(right.title)),
    [memorableDaysQuery.data],
  );
  const todayItems = useMemo(() => sortedItems.filter((item) => item.date === today), [sortedItems, today]);

  return {
    memorableDays: sortedItems,
    todayItems,
    isLoading: memorableDaysQuery.isLoading,
    visibleMonth,
    setVisibleMonth,
    createMemorableDay: (payload: MemorableDayPayload) => createMutation.mutateAsync(payload),
    updateMemorableDay: (id: number, payload: MemorableDayPayload) => updateMutation.mutateAsync({ id, payload }),
    deleteMemorableDay: (id: number) => deleteMutation.mutateAsync(id),
    isSaving: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
    weekStart: "monday" as "sunday" | "monday",
  };
}

export const memorableDayPayloadSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(1),
  emoji: z.string().trim().max(16).default(""),
  description: z.string().max(1000).default(""),
});
