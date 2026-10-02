import { expect, test } from "bun:test";
import path from "node:path";

async function bundleForBrowser(entry: string) {
  return Bun.build({ entrypoints: [path.join(import.meta.dir, entry)], target: "browser", throw: false });
}

/**
 * The iOS build runs these routes inside a WebView. One import of `bun:sqlite`
 * or `node:fs` anywhere below api.ts breaks that build, and nothing on the
 * server would notice.
 */
test("the shared API bundles for a browser", async () => {
  const result = await bundleForBrowser("api.ts");
  expect(result.logs.map((log) => log.message)).toEqual([]);
  expect(result.success).toBe(true);
});

test("the check fails on a module that needs Bun", async () => {
  const result = await bundleForBrowser("open-db.ts");
  expect(result.success).toBe(false);
});
