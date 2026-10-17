import { expect, test } from "@playwright/test";
import { e2eUser, uniqueText } from "./helpers";

/*
 * Issue #62. Both halves are wiring the unit tests mock away: the login
 * screen's realm choice has to survive the sign-in and pick the landing
 * page, and registering has to create an account and leave you signed in.
 */
test.beforeEach(async ({ page }) => {
  await page.context().clearCookies();
  await page.addInitScript(() => localStorage.clear());
});

test("the realm picked before signing in is the one you land in", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("group", { name: "Switch app" }).getByRole("button", { name: "Money" }).click();

  await page.getByLabel("Email").fill(e2eUser.email);
  await page.getByLabel("Password").fill(e2eUser.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveTitle(/Money/);
  expect(await page.getAttribute("html", "data-realm")).toBe("money");
});

test("Settings is not offered as a landing place", async ({ page }) => {
  await page.goto("/");
  const switcher = page.getByRole("group", { name: "Switch app" });
  await expect(switcher.getByRole("button", { name: "Health" })).toBeVisible();
  await expect(switcher.getByRole("button", { name: "Money" })).toBeVisible();
  await expect(switcher.getByRole("button", { name: "Settings" })).toHaveCount(0);
});

test("creating an account signs you straight in", async ({ page }) => {
  const email = `${uniqueText("signup").replace(/\s+/g, "-")}@example.com`;
  await page.goto("/");
  await page.getByRole("button", { name: /No account yet/i }).click();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Password123");
  await page.getByRole("button", { name: /Create account/i }).click();

  // No second trip through the sign-in form: registering carries the session.
  // The nav is the tell — the login screen renders a realm switcher too, so
  // that one no longer separates signed-in from signed-out.
  await expect(page.getByRole("button", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Create account/i })).toHaveCount(0);
});

test("a taken email is refused with a message, not a blank failure", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /No account yet/i }).click();

  await page.getByLabel("Email").fill(e2eUser.email);
  await page.getByLabel("Password").fill("Password123");
  await page.getByRole("button", { name: /Create account/i }).click();

  await expect(page.getByText(/already has an account/i)).toBeVisible();
});
