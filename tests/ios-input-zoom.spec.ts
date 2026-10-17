import { expect, test } from "@playwright/test";
import { navigateTo, openApp } from "./helpers";

/**
 * iOS zooms the page in when you focus a form control whose text is under
 * 16px, and never zooms back out. The guard is a `pointer: coarse` rule in
 * styles.css; this pins that every control a reader can type into clears the
 * threshold on a touch device, and that mice keep the compact size.
 *
 * isMobile drives the emulation that makes `pointer: coarse` match. Chromium
 * only — which is the whole suite here.
 */
// Kept in step with the exclusion list in styles.css: the rule exempts the
// controls with no text to read, and a selector that exempts a different set
// would either miss a zooming control or fail on one that cannot zoom.
const TYPEABLE =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="hidden"]), textarea, select';

async function fontSizes(page: import("@playwright/test").Page) {
  return page.$$eval(TYPEABLE, (nodes) =>
    nodes.map((n) => ({ tag: n.tagName.toLowerCase(), size: parseFloat(getComputedStyle(n).fontSize) })),
  );
}

test.describe("touch device", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });

  test("every typeable control clears the iOS zoom threshold", async ({ page }) => {
    await openApp(page);
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);

    for (const section of ["CBT", "DBT", "Diary", "Pain"]) {
      // The nav lives in the drawer at this width, so every hop opens it.
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.getByRole("button", { name: section, exact: true }).click();
      const sizes = await fontSizes(page);
      expect(sizes.length, `${section} should render some inputs`).toBeGreaterThan(0);
      for (const { tag, size } of sizes) {
        expect(size, `${section}: <${tag}> at ${size}px would make iOS zoom`).toBeGreaterThanOrEqual(16);
      }
    }
  });
});

test("a mouse keeps the compact control size", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openApp(page);
  await navigateTo(page, "CBT");
  const sizes = await fontSizes(page);
  expect(sizes.some(({ size }) => size < 16)).toBe(true);
});
