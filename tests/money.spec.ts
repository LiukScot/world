import { expect, test } from "@playwright/test";
import { navigateTo, openApp, openEntryView, uniqueText } from "./helpers";

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await page.getByRole("group", { name: "Switch app" }).getByRole("button", { name: "Money" }).click();
  await navigateTo(page, "Transactions");
  await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
});

test("shows a transactions empty state when there are none", async ({ page }) => {
  await openEntryView(page, "history");
  await expect(page.getByText("No transactions yet")).toBeVisible();
});

// The one journey the Money realm has to keep: a row typed into the form ends
// up in the history list. Everything finer-grained (derived type, replace
// windows, statement parsing) lives in backend and vitest unit tests.
test("a transaction saved from the form appears in the history", async ({ page }) => {
  const asset = uniqueText("asset").toLowerCase();
  await page.getByLabel("Date").fill("2026-03-28");
  await page.getByLabel("Asset").fill(asset);
  await page.getByLabel("Buy value").fill("120.5");
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.getByRole("button", { name: "✓ Saved" })).toBeVisible();

  await openEntryView(page, "history");
  const row = page.locator("details").filter({ hasText: asset });
  await expect(row).toHaveCount(1);
  await expect(row.getByText("nuovo vincolo")).toBeVisible();
});
