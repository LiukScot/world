import { Profiler } from "react";
import { describe, expect, test, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the network boundary only: apiFetch is the single HTTP call site.
vi.mock("../lib", async () => {
  const actual = await vi.importActual<typeof import("../lib")>("../lib");
  return { ...actual, apiFetch: vi.fn().mockResolvedValue([]) };
});

import { useMemorableDays } from "../hooks/use-memorable-days";
import { MemorableDaysSection } from "./memorable-days";

// Same wiring as App: the hook's return value is a fresh object every render.
function Host() {
  const memorable = useMemorableDays();
  return <MemorableDaysSection memorable={memorable} />;
}

describe("MemorableDaysSection", () => {
  test("an open modal does not keep re-rendering the page", async () => {
    // Throwing ends a runaway loop here; left alone it starves the test's
    // own timers and the run hangs instead of failing.
    let commits = 0;
    const countCommit = () => {
      commits += 1;
      if (commits > 100) throw new Error("MemorableDaysSection keeps re-rendering");
    };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <Profiler id="memorable-days" onRender={countCommit}>
          <Host />
        </Profiler>
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getAllByRole("button", { name: "Add new" })[0]);
    expect(await screen.findByRole("dialog", { name: "Add memorable day" })).toBeInTheDocument();

    const settled = commits;
    await act(() => new Promise((resolve) => setTimeout(resolve, 200)));
    expect(commits - settled).toBeLessThan(5);
  });
});
