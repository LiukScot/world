import { useState } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiEnvelopeSchema, apiFetch, getErrorMessage } from "../lib";
import { defaultPrefsValue, prefsSchema } from "../app/core";

export function usePrefs() {
  const queryClient = useQueryClient();

  const prefsQuery = useQuery({
    queryKey: ["prefs"],
    queryFn: async () => apiFetch("/api/v1/preferences", { method: "GET" }, (raw) => prefsSchema.parse(raw).data),
  });

  const prefsMutation = useMutation({
    mutationFn: async (values: { model: string; chatRange: string; lastRange: string; graphSelection: Record<string, unknown> }) =>
      apiFetch("/api/v1/preferences", { method: "PUT", body: JSON.stringify(values) }, (raw) =>
        apiEnvelopeSchema(z.object({ ok: z.boolean() })).parse(raw).data,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["prefs"] });
    },
  });

  const savePrefsPatch = (
    patch: Partial<{ model: string; chatRange: string; lastRange: string; graphSelection: Record<string, unknown> }>,
  ) => {
    const base = prefsQuery.data ?? defaultPrefsValue;
    prefsMutation.mutate({
      model: patch.model ?? base.model,
      chatRange: patch.chatRange ?? base.chatRange,
      lastRange: patch.lastRange ?? base.lastRange,
      graphSelection: patch.graphSelection ?? base.graphSelection,
    });
  };

  return { prefsQuery, prefsMutation, savePrefsPatch };
}

export function useSettings() {
  const queryClient = useQueryClient();
  const [purgeConfirmArmed, setPurgeConfirmArmed] = useState(false);

  const purgeMutation = useMutation({
    mutationFn: async () =>
      apiFetch("/api/v1/data/purge", { method: "POST" }, (raw) =>
        apiEnvelopeSchema(z.object({ ok: z.boolean() })).parse(raw).data,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      setPurgeConfirmArmed(false);
    },
  });

  return {
    purgeConfirmArmed,
    purgePending: purgeMutation.isPending,
    purgeError: purgeMutation.error ? { tone: "error" as const, text: getErrorMessage(purgeMutation.error) } : null,
    onPurgeArm: () => {
      purgeMutation.reset();
      setPurgeConfirmArmed(true);
    },
    onPurgeConfirm: () => purgeMutation.mutate(),
    onPurgeCancel: () => {
      purgeMutation.reset();
      setPurgeConfirmArmed(false);
    },
  };
}
