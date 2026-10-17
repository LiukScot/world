import { afterEach, describe, expect, test, vi } from "vitest";
import { onlineManager } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { createQueryClient } from "./query-client";

let client: QueryClient | undefined;

// mount() is what QueryClientProvider does: it resumes paused mutations when
// the connection comes back.
function runMutation() {
  const mutationFn = vi.fn().mockResolvedValue("saved");
  client = createQueryClient();
  client.mount();
  const mutation = client.getMutationCache().build(client, { mutationFn });
  return { mutationFn, result: mutation.execute(undefined) };
}

describe("createQueryClient offline behavior", () => {
  afterEach(() => {
    client?.unmount();
    onlineManager.setOnline(true);
  });

  test("runs mutations while offline", async () => {
    onlineManager.setOnline(false);
    const { mutationFn, result } = runMutation();
    await expect(result).resolves.toBe("saved");
    expect(mutationFn).toHaveBeenCalledTimes(1);
  });
});

describe("createQueryClient caching", () => {
  test("keeps fetched data instead of refetching it on every visit", async () => {
    client = createQueryClient();
    const queryFn = vi.fn().mockResolvedValue("rows");
    await client.fetchQuery({ queryKey: ["diary"], queryFn });
    await client.ensureQueryData({ queryKey: ["diary"], queryFn });
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(["diary"])?.isInvalidated).toBe(false);
  });

  test("an invalidation by key prefix reaches the dashboard's all-time queries", () => {
    client = createQueryClient();
    client.setQueryData(["diary", "all"], []);
    client.setQueryData(["diary", null, null], []);
    void client.invalidateQueries({ queryKey: ["diary"] });
    expect(client.getQueryState(["diary", "all"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["diary", null, null])?.isInvalidated).toBe(true);
  });
});
