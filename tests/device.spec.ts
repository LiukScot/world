import { expect, test } from "@playwright/test";

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
