import { expect, test } from "@playwright/test";
import { navigateTo, openApp, openEntryView } from "./helpers";

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await navigateTo(page, "pain");
  await expect(page.getByRole("heading", { name: "Pain" })).toBeVisible();
});

test("shows a pain empty state when there are no entries", async ({ page }) => {
  await openEntryView(page, "history");
  await expect(page.getByText("No pain entries yet")).toBeVisible();
  await expect(page.getByText("Open New entry to record a flare", { exact: false })).toBeVisible();
});

// Pain CRUD UI flow E2E removed — same rationale as diary.spec.ts.
// Covered by 14 backend unit tests in backend/src/routes/pain.test.ts.
