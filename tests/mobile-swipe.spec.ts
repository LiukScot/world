import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

/**
 * Issue #74: a swipe is one gesture, so it moves one thing. Once the drawer
 * drag is committed the page must stop scrolling under it, and once the
 * finger goes vertical the drawer must stay put for the rest of the gesture.
 *
 * The check is `defaultPrevented` on the touchmove, which is what tells the
 * browser whether to scroll. Synthetic touches never scroll a real page, so
 * asserting on scrollTop here would pass no matter what the handler did.
 */
type Move = { x: number; y: number };

async function swipe(page: import("@playwright/test").Page, start: Move, moves: Move[]) {
  return page.evaluate(
    ({ start, moves }) => {
      const fire = (type: string, x: number, y: number) => {
        const touch = new Touch({ identifier: 1, target: document.body, clientX: x, clientY: y });
        const event = new TouchEvent(type, {
          cancelable: true,
          bubbles: true,
          touches: type === "touchend" ? [] : [touch],
          changedTouches: [touch],
        });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      };
      fire("touchstart", start.x, start.y);
      const prevented = moves.map((m) => fire("touchmove", m.x, m.y));
      fire("touchend", moves[moves.length - 1].x, moves[moves.length - 1].y);
      return prevented;
    },
    { start, moves },
  );
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openApp(page);
});

test("a horizontal drawer swipe cancels the page scroll", async ({ page }) => {
  const prevented = await swipe(page, { x: 10, y: 400 }, [
    { x: 30, y: 402 },
    { x: 120, y: 406 },
  ]);
  expect(prevented).toEqual([true, true]);
});

test("a vertical swipe scrolls and leaves the drawer alone", async ({ page }) => {
  const prevented = await swipe(page, { x: 200, y: 400 }, [
    { x: 202, y: 340 },
    { x: 206, y: 260 },
  ]);
  expect(prevented).toEqual([false, false]);
});
