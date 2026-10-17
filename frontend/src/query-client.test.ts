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
