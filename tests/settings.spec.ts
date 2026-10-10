import { expect, test } from "@playwright/test";
import { openApp, openSettingsRealm, openSettingsSection } from "./helpers";

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await openSettingsRealm(page);
});

test("switches theme and persists it across reload", async ({ page }) => {
  await openSettingsSection(page, "Appearance");

  // The radio is visually hidden inside its card, so the click goes where a
  // user's click goes — on the label — and the radio is asserted after.
  const grey = page.getByRole("radio", { name: /Grey/ });
  await page.locator("label", { has: grey }).click();
  await expect(grey).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "grey");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "grey");
});
