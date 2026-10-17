import { expect, test } from "@playwright/test";
import { navigateTo, openApp, openEntryView } from "./helpers";

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await navigateTo(page, "diary");
  await expect(page.getByRole("heading", { name: "Diary" })).toBeVisible();
});

test("shows a diary empty state when there are no entries", async ({ page }) => {
  await openEntryView(page, "history");
  await expect(page.getByText("No diary entries yet")).toBeVisible();
  await expect(page.getByText("Open New entry to log how today felt", { exact: false })).toBeVisible();
});

// Diary CRUD UI flow E2E removed — was brittle to UI changes (tab-switched
// chips, evolving submit button selector). Covered now by 17 backend unit
// tests in backend/src/routes/diary.test.ts via Hono testClient. Per audit
// DOWN-LEVEL recommendation — keep E2E for empty-state + journey only.
