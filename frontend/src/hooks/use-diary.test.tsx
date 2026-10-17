import { describe, expect, test, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const { toastSuccess, toastError, apiFetch } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  apiFetch: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

// Mock the network boundary only: apiFetch is the single HTTP call site.
vi.mock("../lib", async () => {
  const actual = await vi.importActual<typeof import("../lib")>("../lib");
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});

import { useDiary } from "./use-diary";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const validEntry = {
  dateTime: "2026-06-07T10:00",
  moodLevel: null,
  depressionLevel: null,
  anxietyLevel: null,
  positiveMoods: "",
  negativeMoods: "",
  generalMoods: "",
  description: "",
  gratitude: "",
};

describe("useDiary toasts", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    apiFetch.mockReset();
  });

  test("fires a success toast when a diary entry saves", async () => {
    apiFetch.mockResolvedValue({ id: 1 });
    const { result } = renderHook(() => useDiary(), { wrapper });

    result.current.diaryMutation.mutate(validEntry);

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Entry saved"));
    expect(toastError).not.toHaveBeenCalled();
  });

  test("fires an error toast when the save fails", async () => {
    apiFetch.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useDiary(), { wrapper });

    result.current.diaryMutation.mutate(validEntry);

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Couldn't save entry. Try again."));
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
