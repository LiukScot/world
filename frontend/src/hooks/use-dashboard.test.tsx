import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));

// Mock the network boundary only: apiFetch is the single HTTP call site.
vi.mock("../lib", async () => {
  const actual = await vi.importActual<typeof import("../lib")>("../lib");
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});

import { useDashboard } from "./use-dashboard";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function anxietyColor(series: { key: string; color: string }[]): string {
  return series.find((s) => s.key === "anxiety")!.color;
}

describe("useDashboard chart theme colors", () => {
  beforeEach(() => {
    apiFetch.mockResolvedValue([]);
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.setProperty("--success", "#111111");
  });

  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.removeProperty("--success");
  });

  test("re-reads CSS vars when the data-theme attribute changes", async () => {
    const { result } = renderHook(() => useDashboard(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(anxietyColor(result.current.wellbeingSeries)).toBe("#111111");

    // Simulate a runtime theme switch: change the CSS var, then flip data-theme.
    act(() => {
      document.documentElement.style.setProperty("--success", "#222222");
      document.documentElement.dataset.theme = "oled";
    });

    await waitFor(() =>
      expect(anxietyColor(result.current.wellbeingSeries)).toBe("#222222"),
    );
  });
});
