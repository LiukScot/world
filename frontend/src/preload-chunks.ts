// Every page is its own lazy chunk. Fetching and evaluating them once the app
// is idle means opening a page finds its code already loaded instead of
// waiting on it. The specifiers must match the lazy() imports in App.tsx and
// the charts inside the sections.
const loaders = [
  () => import("./app/DiarySection"),
  () => import("./app/PainSection"),
  () => import("./app/CbtSection"),
  () => import("./app/DbtSection"),
  () => import("./app/SettingsSection"),
  () => import("./app/memorable-days"),
  () => import("./app/money/TransactionsSection"),
  () => import("./app/money/MovementsSection"),
  () => import("./app/money/SnapshotsSection"),
  () => import("./app/money/MoneyDashboardSection"),
  () => import("./app/WellbeingChart"),
  () => import("./app/money/AssetCharts"),
  () => import("./app/money/MonthlyRiskChart"),
];

// requestIdleCallback is missing in Safari, which is what the iOS app runs on.
const START_DELAY_MS = 1000;

/** Loads every page chunk in the background, one at a time. Returns a cancel function. */
export function preloadChunks(): () => void {
  let cancelled = false;
  const timer = window.setTimeout(async () => {
    for (const load of loaders) {
      if (cancelled) return;
      try {
        await load();
      } catch (error) {
        // A failed preload only means that page loads on first visit as before.
        console.warn("Could not preload a page:", error);
      }
    }
  }, START_DELAY_MS);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}
