import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

test("desktop shows calendar and list, create/edit/delete works", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Memorable days" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Memorable days" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Prev" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "All memorable days" })).toBeVisible();

  await page.getByRole("button", { name: "Add new" }).click();
  await expect(page.getByRole("button", { name: "Emoji" })).toBeVisible();
  await page.getByRole("button", { name: "Emoji" }).click();
  await expect(page.getByRole("searchbox", { name: "Search emoji" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Smileys" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search emoji" }).fill("ring");
  await page.getByRole("button", { name: /ring/i }).first().click();
  await expect(page.getByRole("searchbox", { name: "Search emoji" })).toBeHidden();
  await page.getByRole("button", { name: "Emoji" }).click();
  await expect(page.getByRole("searchbox", { name: "Search emoji" })).toHaveValue("ring");
  await page.getByRole("button", { name: "Emoji" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Title is required.")).toBeVisible();
  await page.getByLabel("Title").fill("Wedding");
  await page.getByLabel("Description").fill("civil ceremony");
  await page.getByRole("button", { name: "Save" }).click();

  const weddingListItem = page.getByRole("button").filter({ hasText: "Wedding" });
  await expect(weddingListItem).toBeVisible();
  await weddingListItem.click();
  await page.getByLabel("Description").fill("updated note");
  await page.getByRole("button", { name: "Save" }).click();
  await weddingListItem.click();
  await expect(page.getByLabel("Description")).toHaveValue("updated note");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await weddingListItem.click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("button").filter({ hasText: "Wedding" })).toHaveCount(0);
});

test("mobile drops the calendar and creates from the floating button", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openApp(page);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Memorable days" }).click();

  await expect(page.getByRole("button", { name: "Prev" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Add new" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "All memorable days" })).toBeVisible();

  await page.getByRole("button", { name: "Add memorable day" }).click();
  await page.getByLabel("Title").fill("Wedding");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button").filter({ hasText: "Wedding" })).toBeVisible();
});
