import { expect, test } from "@playwright/test";
import { diaryRow, memorableDayRow, openApp, painRow, seedHealth } from "./helpers";

test("explains the empty dashboard state", async ({ page }) => {
  await openApp(page);

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("No health entries yet")).toBeVisible();
  await expect(page.getByText("Your averages will appear here after you log your first diary or pain entry.")).toBeVisible();
  await expect(page.getByText("No chart data yet. Add a diary or pain entry to get started.")).toBeVisible();
});

test("renders dashboard data and supports chart toggles", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await seedHealth(page, {
    diary: [
      diaryRow(),
      diaryRow({
        entryDate: "2026-03-25",
        entryTime: "09:00",
        moodLevel: 4,
        depressionLevel: 4,
        anxietyLevel: 3,
        description: "tired but stable",
      }),
      diaryRow({
        entryDate: "2026-03-26",
        entryTime: "09:00",
        moodLevel: 3,
        depressionLevel: 6,
        anxietyLevel: 7,
        description: "stressful day",
      }),
      diaryRow({
        entryDate: "2026-03-27",
        entryTime: "09:00",
        moodLevel: 8,
        depressionLevel: 2,
        anxietyLevel: 2,
        description: "felt much calmer",
      }),
    ],
    pain: [
      painRow(),
      painRow({
        entryDate: "2026-03-25",
        entryTime: "09:30",
        painLevel: 3,
        fatigueLevel: 2,
        coffeeCount: 1,
        note: "manageable morning",
      }),
      painRow({
        entryDate: "2026-03-26",
        entryTime: "09:30",
        painLevel: 7,
        fatigueLevel: 8,
        coffeeCount: 4,
        note: "pain spike after poor sleep",
      }),
      painRow({
        entryDate: "2026-03-27",
        entryTime: "09:30",
        painLevel: 2,
        fatigueLevel: 3,
        coffeeCount: 0,
        note: "easy day",
      }),
    ],
  });

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Overview", { exact: true })).toHaveCount(0);
  await expect(page.getByText("current vs previous range")).toHaveCount(0);
  await expect(page.locator(".dashboard-panel-split")).toHaveCount(0);
  const statsGrid = page.getByTestId("averages");
  await expect(statsGrid.locator("article").filter({ hasText: "Journal entries" }).locator("strong")).toHaveText("4");
  await expect(statsGrid.locator("article").filter({ hasText: "Pain entries" }).locator("strong")).toHaveText("4");
  await expect(page.getByText("Patterns", { exact: true })).toBeVisible();
  // Tailwind composes box-shadow from (transparent) layer vars, so a flat
  // button reads as rgba(0,0,0,0)… rather than the literal "none".
  await expect(page.getByRole("button", { name: "1 month" })).toHaveCSS("box-shadow", /none|rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/);
  await expect(page.locator(".dashboard-hero")).toHaveCount(0);
  await expect(page.locator(".dashboard-summary")).toHaveCount(0);
  await expect(page.locator(".dashboard-insight-card")).toHaveCount(0);
  await expect(page.getByTestId("insights")).toBeVisible();
  await expect(statsGrid.locator("article").first()).toHaveCSS("border-top-width", "0px");
  await expect(statsGrid.locator("article").first()).toHaveCSS("box-shadow", "none");
  await expect(statsGrid.locator("article").first()).toHaveCSS("background-color", "rgb(30, 30, 34)");
  await expect(page.getByTestId("series-toggle").first()).toHaveCSS("border-top-width", "0px");
  await expect(page.getByLabel("From date")).toHaveCSS("font-size", "13px");
  await expect(page.getByLabel("From date")).toHaveCSS("font-weight", "500");
  await page.setViewportSize({ width: 850, height: 1000 });
  /*
   * The contract is the hierarchy, not a pixel ceiling: one metric leads
   * at the full width of the row, the rest sit a tier below it, two to a
   * row at this width. The old assertion capped every card at 190px,
   * which described the auto-filled grid this replaced.
   */
  const heroBox = await statsGrid.locator("article").nth(0).boundingBox();
  const tierBox = await statsGrid.locator("article").nth(1).boundingBox();
  expect(tierBox?.width ?? 0).toBeLessThan((heroBox?.width ?? 0) * 0.75);
  // Same row, so the tier reads as one group rather than a column of ones.
  const secondTierBox = await statsGrid.locator("article").nth(2).boundingBox();
  expect(tierBox?.y).toBe(secondTierBox?.y);

  // Wait for chart canvas to render dynamically
  await page.waitForSelector("canvas", { timeout: 5000 });
  await expect(page.locator("canvas")).toBeVisible();

  // Uncheck all metrics by text label (using parent locator to find input)
  await page.getByText("Pain", { exact: true }).locator("..").locator("input[type='checkbox']").uncheck();
  await page.getByText("Fatigue", { exact: true }).locator("..").locator("input[type='checkbox']").uncheck();
  await page.getByText("Mood", { exact: true }).locator("..").locator("input[type='checkbox']").uncheck();
  await page.getByText("Depression", { exact: true }).locator("..").locator("input[type='checkbox']").uncheck();
  await page.getByText("Anxiety", { exact: true }).locator("..").locator("input[type='checkbox']").uncheck();
  
  await expect(page.getByText("Toggle on a metric to see it.")).toBeVisible();

  // Check mood again
  await page.getByText("Mood", { exact: true }).locator("..").locator("input[type='checkbox']").check();
  await page.waitForSelector("canvas", { timeout: 5000 });
  await expect(page.locator("canvas")).toBeVisible();

  await page.getByRole("button", { name: "1 week" }).click();
  await expect(page.getByRole("button", { name: "1 week" })).toHaveAttribute("aria-pressed", "true");
});

test("shows anniversary cards above averages", async ({ page }) => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  await seedHealth(page, {
    memorableDays: [memorableDayRow({ date: `${yyyy}-${mm}-${dd}`, title: "Wedding", emoji: "💍", description: "civil ceremony" })],
  });

  await expect(page.getByText("Anniversaries today")).toBeVisible();
  await expect(page.getByText("💍 Wedding")).toBeVisible();
  await expect(page.getByText("civil ceremony")).toBeVisible();
});
