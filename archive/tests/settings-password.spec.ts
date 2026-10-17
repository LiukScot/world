import { expect, test } from "@playwright/test";
import { e2eUser, loginUi, openAccountPanel, openSettingsRealm, purgeUserData } from "./helpers";

test.beforeEach(async ({ request, page }) => {
  await purgeUserData(request);
  await loginUi(page);
  await openSettingsRealm(page);
});

test("changes password and restores the original password", async ({ page }) => {
  const temporaryPassword = "Password456";

  await openAccountPanel(page);
  await page.getByLabel("Current password").fill(e2eUser.password);
  await page.getByLabel("New password").fill(temporaryPassword);
  await page.getByLabel("Confirm").fill(temporaryPassword);
  await page.getByRole("button", { name: "Change password" }).click();
  
  // Wait for password update confirmation
  await expect(page.getByText("Password updated.")).toBeVisible();
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: "Log out" }).click();
  await loginUi(page, temporaryPassword);

  await openSettingsRealm(page);
  await openAccountPanel(page);
  await page.getByLabel("Current password").fill(temporaryPassword);
  await page.getByLabel("New password").fill(e2eUser.password);
  await page.getByLabel("Confirm").fill(e2eUser.password);
  await page.getByRole("button", { name: "Change password" }).click();
  
  // Wait for password update confirmation 
  await expect(page.getByText("Password updated.")).toBeVisible();
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: "Log out" }).click();
  await loginUi(page);
});
