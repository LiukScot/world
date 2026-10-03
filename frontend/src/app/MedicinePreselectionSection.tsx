import { useEffect, useState } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiEnvelopeSchema, apiFetch, getErrorMessage } from "../lib";
import { csvToList, listToCsv, painOptionsSchema } from "./core";
import { InlineFeedback, MultiSelectField, SectionHead } from "./shared";

/**
 * Medicine preselection settings. Reuses the Pain/Diary pill selector
 * (MultiSelectField) so the UX matches the rest of the app: a "selected"
 * pill here means "preselected by default in a new pain entry". Queries pain
 * options directly (shared cache with the Pain form) so the parent
 * SettingsSection doesn't need to thread props.
 */
export function MedicinePreselectionSection({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();

  const optionsQuery = useQuery({
    queryKey: ["pain-options"],
    enabled,
    queryFn: async () => apiFetch("/api/v1/pain/options", { method: "GET" }, (raw) => painOptionsSchema.parse(raw).data),
  });

  const medicines = optionsQuery.data?.medicines ?? [];
  const preselectedCsv = listToCsv(optionsQuery.data?.preselectedMedicines ?? []);

  const [value, setValue] = useState(preselectedCsv);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setValue(preselectedCsv); }, [preselectedCsv]);

  const preselectMutation = useMutation({
    mutationFn: async (vars: { value: string; preselected: boolean }) =>
      apiFetch(
        "/api/v1/pain/options/preselect",
        { method: "POST", body: JSON.stringify({ field: "medicines", value: vars.value, preselected: vars.preselected }) },
        (raw) => apiEnvelopeSchema(z.object({ ok: z.boolean() })).parse(raw).data,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pain-options"] });
    },
  });

  const handleChange = (next: string) => {
    const prev = csvToList(value);
    const prevSet = new Set(prev.map((medicine) => medicine.toLowerCase()));
    const nextList = csvToList(next);
    const nextSet = new Set(nextList.map((medicine) => medicine.toLowerCase()));
    setValue(next);
    for (const medicine of nextList) {
      if (!prevSet.has(medicine.toLowerCase())) preselectMutation.mutate({ value: medicine, preselected: true });
    }
    for (const medicine of prev) {
      if (!nextSet.has(medicine.toLowerCase())) preselectMutation.mutate({ value: medicine, preselected: false });
    }
  };

  return (
    <div className="grid gap-3">
      <SectionHead title="Medicine preselection" variant="accent" />
      <p className="text-muted text-control">Choose which medicines start already selected when you log a new pain entry.</p>
      {optionsQuery.isLoading ? (
        <p className="text-muted text-control">Loading…</p>
      ) : (
        <MultiSelectField hideLabel label="Medicines" fieldKey="medicines" value={value} options={medicines} onChange={handleChange} />
      )}
      <InlineFeedback message={preselectMutation.error ? { tone: "error", text: getErrorMessage(preselectMutation.error) } : null} />
    </div>
  );
}
