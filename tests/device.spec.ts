import { expect, test } from "@playwright/test";
import { openSettingsRealm, openSettingsSection } from "./helpers";

/*
 * The device build has no server. These run against static files, so every
 * API call has to be answered by the backend running inside the page.
 */
test("opens signed in, saves an entry, and keeps it after a reload", async ({ page }) => {
  const escaped: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) escaped.push(request.url());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.getByRole("button", { name: "CBT", exact: true }).click();
  await expect(page.getByRole("heading", { name: "CBT Thought Response" })).toBeVisible();
  await page.getByLabel("Situation").fill("written with no server");
  await page.getByRole("button", { name: /Save entry/i }).click();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.locator("details").filter({ hasText: "written with no server" })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "CBT", exact: true }).click();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.locator("details").filter({ hasText: "written with no server" })).toBeVisible();

  expect(escaped).toEqual([]);
});

test("a JSON export restores into a fresh install", async ({ page, browser, baseURL }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "CBT", exact: true }).click();
  await page.getByLabel("Situation").fill("carried over in a backup");
  await page.getByRole("button", { name: /Save entry/i }).click();
  await page.getByRole("button", { name: "History" }).click();
  await expect(page.locator("details").filter({ hasText: "carried over in a backup" })).toBeVisible();

  await openSettingsRealm(page);
  await openSettingsSection(page, "Health");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).first().click();
  const backupPath = await (await downloading).path();

  // A new context has its own IndexedDB: an empty install.
  const fresh = await browser.newContext({ baseURL });
  try {
    const phone = await fresh.newPage();
    await phone.goto("/");
    await openSettingsRealm(phone);
    await openSettingsSection(phone, "Health");
    await phone.locator('input[type="file"][accept=".json"]').setInputFiles(backupPath);
    await expect(phone.getByText("JSON import completed.")).toBeVisible();

    await phone.getByRole("group", { name: "Switch app" }).getByRole("button", { name: "Health" }).click();
    await phone.getByRole("button", { name: "CBT", exact: true }).click();
    await phone.getByRole("button", { name: "History" }).click();
    await expect(phone.locator("details").filter({ hasText: "carried over in a backup" })).toBeVisible();
  } finally {
    await fresh.close();
  }
});
