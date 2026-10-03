import { afterEach, describe, expect, test, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const { toastSuccess, toastError } = vi.hoisted(() => ({ toastSuccess: vi.fn(), toastError: vi.fn() }));

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

import { jsonImportPath, useDataBackup } from "./use-data-backup";

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe("useDataBackup spreadsheet import", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  test("shows the server's message, not the raw error envelope", async () => {
    const message = 'Import failed: diary row 3: date "16/05/2026" is not YYYY-MM-DD';
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "IMPORT_FAILED", message } }), { status: 422 }),
    ));
    const { result } = renderHook(() => useDataBackup(), { wrapper });

    result.current.onImportXlsx(new File(["x"], "world.xlsx"));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(message));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  test("falls back to the status when the response is not the error envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Bad Gateway", { status: 502 })));
    const { result } = renderHook(() => useDataBackup(), { wrapper });

    result.current.onImportXlsx(new File(["x"], "world.xlsx"));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Spreadsheet import failed (HTTP 502)"));
  });
});

describe("jsonImportPath", () => {
  test("routes a single backup and the older one-realm files", () => {
    expect(jsonImportPath({ health: {}, money: {} })).toBe("/api/v1/full-backup/json/import");
    expect(jsonImportPath({ transactions: [], assetColors: {} })).toBe("/api/v1/money/backup/json/import");
    expect(jsonImportPath({ diary: { rows: [] }, pain: { rows: [] } })).toBe("/api/v1/backup/json/import");
  });
});
