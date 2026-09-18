import { expect, test } from "@playwright/test";
import { loginApi, loginUi, navigateTo, openEntryView, uniqueText } from "./helpers";

async function purgeMoneyData(request: Parameters<typeof loginApi>[0]) {
  await loginApi(request);
  const response = await request.post("/api/v1/money/data/purge");
  expect(response.ok(), "expected money purge to succeed").toBeTruthy();
}

test.beforeEach(async ({ request, page }) => {
  await purgeMoneyData(request);
  await loginUi(page);
  await page.getByRole("group", { name: "Switch app" }).getByRole("button", { name: "Money" }).click();
  await navigateTo(page, "Transactions");
  await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
});

test.afterEach(async ({ request }) => {
  await purgeMoneyData(request);
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
