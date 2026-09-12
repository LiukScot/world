import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import {
  useAuth, useDiary, usePain, useCbt, useDbt, useDashboard, useMemorableDays,
  useMoneyDashboard, useMoneyMovements, useMoneySettings, useMoneySnapshots, useMoneyTransactions, useSettings,
} from "./hooks";
import { LoginScreen } from "./app/LoginScreen";
import { Sidebar } from "./app/Sidebar";
import { DashboardSection } from "./app/DashboardSection";
import { SectionErrorBoundary } from "./app/ErrorBoundary";
import { EntryViewTabs, type EntryView } from "./app/entries";
import { StageHeadSlot } from "./app/stage-head-slot";
import {
  entryViewLabels, formatDocumentTitle, hasEntryViews, navItemsByRealm, navLabels, readStoredRealm, realmOf,
  REALM_STORAGE_KEY, type NavItem,
} from "./app/core";

// The Dashboard is the default view and stays eager so the first paint after
// login has no loading flash. The other sections are reached only via nav, so
// they are lazy-loaded — this keeps each section's form code and its heaviest
// dependency (memorable-days pulls in the full emoji dataset) out of the
// initial bundle until the user actually opens that section.
const DiarySection = lazy(() => import("./app/DiarySection").then((m) => ({ default: m.DiarySection })));
const PainSection = lazy(() => import("./app/PainSection").then((m) => ({ default: m.PainSection })));
const CbtSection = lazy(() => import("./app/CbtSection").then((m) => ({ default: m.CbtSection })));
const DbtSection = lazy(() => import("./app/DbtSection").then((m) => ({ default: m.DbtSection })));
const SettingsSection = lazy(() => import("./app/SettingsSection").then((m) => ({ default: m.SettingsSection })));
const MemorableDaysSection = lazy(() => import("./app/memorable-days").then((m) => ({ default: m.MemorableDaysSection })));
const TransactionsSection = lazy(() => import("./app/money/TransactionsSection").then((m) => ({ default: m.TransactionsSection })));
const MovementsSection = lazy(() => import("./app/money/MovementsSection").then((m) => ({ default: m.MovementsSection })));
const SnapshotsSection = lazy(() => import("./app/money/SnapshotsSection").then((m) => ({ default: m.SnapshotsSection })));
const MoneyDashboardSection = lazy(() => import("./app/money/MoneyDashboardSection").then((m) => ({ default: m.MoneyDashboardSection })));

function App() {
  const auth = useAuth();
  const loggedIn = !!auth.user;
  // The realm is derived from the nav item (money's items are `money-`
  // prefixed), so there is only one piece of state to keep straight. The
  // last realm is remembered so a reload lands you back where you were.
  const [nav, setNav] = useState<NavItem>(() => navItemsByRealm[readStoredRealm()][0]);
  const realm = realmOf(nav);
  /*
   * New entry vs History, for the pages that have both. It lives here
   * rather than inside each screen because the mobile sticky head renders
   * the same control, and two copies of one piece of state drift. Leaving
   * a page resets it: arriving at Pain should offer the form.
   */
  const [entryView, setEntryView] = useState<EntryView>("new");
  // Filled by the sticky head below; the staged screens portal their
  // progress dots into it (see StageHeadSlot).
  const [headSlot, setHeadSlot] = useState<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const goToNav = (item: NavItem) => { setNav(item); setEntryView("new"); };
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Mirror of mobileSidebarOpen for the swipe handler closure to read,
  // so the swipe useEffect can run once at mount instead of re-running
  // every time the sidebar opens or closes.
  const mobileSidebarOpenRef = useRef(mobileSidebarOpen);
  useEffect(() => { mobileSidebarOpenRef.current = mobileSidebarOpen; }, [mobileSidebarOpen]);

  // When the drawer opens, move focus to its close button (so keyboard
  // and screen-reader users land inside the drawer). When it closes, return
  // focus to the hamburger that opened it. The ref guards against auto-
  // focusing anything on initial mount.
  const drawerWasOpenRef = useRef(false);
  useEffect(() => {
    if (mobileSidebarOpen) {
      drawerWasOpenRef.current = true;
      document.querySelector<HTMLButtonElement>(".sidebar-close-btn")?.focus();
    } else if (drawerWasOpenRef.current) {
      drawerWasOpenRef.current = false;
      document.querySelector<HTMLButtonElement>(".mobile-menu-btn")?.focus();
    }
  }, [mobileSidebarOpen]);

  // While the drawer is open: Esc closes it, and Tab cycles focus only
  // among the drawer's interactive elements (focus trap).
  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileSidebarOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const sidebar = document.querySelector<HTMLElement>(".sidebar");
      if (!sidebar) return;
      const focusables = sidebar.querySelectorAll<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (active && !sidebar.contains(active)) {
        // Focus drifted outside the drawer somehow — pull it back.
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileSidebarOpen]);

  // Reset the scroll position whenever the user navigates, so the new
  // screen doesn't start mid-scroll.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [nav, entryView]);

  useEffect(() => {
    document.title = loggedIn
      ? formatDocumentTitle(navLabels[nav], realm)
      : formatDocumentTitle("Sign in");
  }, [loggedIn, nav, realm]);

  // Drive the accent (see :root[data-realm] in styles.css) and remember the
  // choice. index.html replays it before first paint to avoid a flash of the
  // wrong accent; keep the two lists of realm ids in sync.
  useEffect(() => {
    document.documentElement.dataset.realm = realm;
    try {
      localStorage.setItem(REALM_STORAGE_KEY, realm);
    } catch {
      // Persisting is best-effort; the live attribute change still applies.
    }
  }, [realm]);

  const diary = useDiary(loggedIn);
  const pain = usePain(loggedIn);
  const cbt = useCbt(loggedIn);
  const dbt = useDbt(loggedIn);
  const dashboard = useDashboard(loggedIn);
  const memorable = useMemorableDays(loggedIn);
  const settings = useSettings();
  // Only fetched once you're actually in the Money realm — the health realm
  // has no use for it and shouldn't pay for the request.
  const moneyTx = useMoneyTransactions(loggedIn && realm === "money");
  const moneyMovements = useMoneyMovements(loggedIn && nav === "money-movements");
  const moneySnapshots = useMoneySnapshots(loggedIn && nav === "money-snapshots");
  const moneySettings = useMoneySettings(loggedIn && nav === "settings-money");
  const moneyDashboard = useMoneyDashboard(loggedIn && nav === "money-dashboard");

  // Interactive swipe gestures: the sidebar follows the finger 1:1 during
  // the drag, then snaps open or closed on release based on how far it moved.
  useEffect(() => {
    const MOBILE_MAX_WIDTH = 720;
    const ACTIVATE_DX = 8;     // min horizontal travel before we hijack the gesture
    const MAX_VERTICAL = 40;   // give up if the user is clearly scrolling vertically

    const isInsideHorizontalScroller = (el: EventTarget | null) => {
      let node = el as HTMLElement | null;
      while (node && node !== document.body) {
        if (node.scrollWidth > node.clientWidth) {
          const overflowX = getComputedStyle(node).overflowX;
          if (overflowX === "auto" || overflowX === "scroll") return true;
        }
        node = node.parentElement;
      }
      return false;
    };

    const getSidebar = () => document.querySelector<HTMLElement>(".sidebar");

    let startX = 0;
    let startY = 0;
    let width = 0;
    let tracking: "open" | "close" | null = null;
    let dragging = false;  // becomes true once we commit to a horizontal swipe
    let pendingCleanupTimer: number | null = null;
    let pendingCleanup: (() => void) | null = null;

    // Cancel any pending snap-animation cleanup from a previous gesture so it
    // can't fire mid-drag and wipe inline styles we're actively writing.
    const cancelPendingCleanup = () => {
      if (pendingCleanupTimer !== null) {
        window.clearTimeout(pendingCleanupTimer);
        pendingCleanupTimer = null;
      }
      if (pendingCleanup) {
        const el = getSidebar();
        if (el) el.removeEventListener("transitionend", pendingCleanup);
        pendingCleanup = null;
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (window.innerWidth > MOBILE_MAX_WIDTH) return;
      cancelPendingCleanup();
      // Clear any leftover inline styles from a previous gesture
      const el = getSidebar();
      if (el) {
        el.style.transform = "";
        el.style.transition = "";
      }
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      width = window.innerWidth;
      dragging = false;
      if (mobileSidebarOpenRef.current) {
        tracking = "close";
      } else if (!isInsideHorizontalScroller(e.target)) {
        tracking = "open";
      } else {
        tracking = null;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (!dragging) {
        // Wait for clear horizontal intent before hijacking the gesture.
        if (Math.abs(dy) > MAX_VERTICAL) { tracking = null; return; }
        if (Math.abs(dx) < ACTIVATE_DX) return;
        if (Math.abs(dy) > Math.abs(dx)) { tracking = null; return; }
        // Wrong-direction swipes are pointless: bail.
        if (tracking === "open" && dx < 0) { tracking = null; return; }
        if (tracking === "close" && dx > 0) { tracking = null; return; }
        dragging = true;
        const el = getSidebar();
        if (el) el.style.transition = "none";  // disable CSS transition during drag
      }
      /*
       * Committed to the horizontal drag, so the page must stop scrolling
       * under it: a swipe that both slides the drawer and scrolls the
       * article behind it is two gestures from one finger. The opposite
       * lock is the bail-out above — once the finger goes vertical,
       * `tracking` is cleared and the drawer stays put for the rest of
       * the gesture.
       *
       * cancelable guard: if the browser already started its own scroll
       * (a slow diagonal that passed the scroll slop before ACTIVATE_DX),
       * preventDefault is a no-op and warns. Nothing to do there — the
       * scroll has begun and cannot be taken back.
       */
      if (e.cancelable) e.preventDefault();
      const el = getSidebar();
      if (!el) return;
      // Compute the live position. Open gesture starts at -width, close at 0.
      const base = tracking === "open" ? -width : 0;
      const pos = Math.min(0, Math.max(-width, base + dx));
      el.style.transform = `translateX(${pos}px)`;
    };

    const onTouchEnd = () => {
      if (!tracking) { dragging = false; return; }
      const el = getSidebar();
      if (el && dragging) {
        // Read the live position from the inline transform we just set.
        const matrix = new DOMMatrixReadOnly(el.style.transform || "translateX(0)");
        const pos = matrix.m41;
        // Commit threshold: 1/3 of screen width.
        // Open gesture commits once the sidebar is dragged at least 1/3 in (pos > -width * 2/3).
        // Close gesture commits once it's pushed at least 1/3 out (pos < -width * 1/3).
        const shouldOpen = tracking === "open"
          ? pos > -width * (2 / 3)
          : pos > -width * (1 / 3);
        // Re-enable the transition and set inline transform to the destination.
        // Inline style overrides the CSS class, so we'll snap-animate to it,
        // and then clear the inline style after the animation finishes so the
        // CSS class takes back control.
        el.style.transition = "";
        el.style.transform = shouldOpen ? "translateX(0)" : `translateX(-${width}px)`;
        const cleanup = () => {
          el.style.transform = "";
          el.style.transition = "";
          el.removeEventListener("transitionend", cleanup);
          if (pendingCleanupTimer !== null) {
            window.clearTimeout(pendingCleanupTimer);
            pendingCleanupTimer = null;
          }
          pendingCleanup = null;
        };
        pendingCleanup = cleanup;
        el.addEventListener("transitionend", cleanup);
        // Safety: if no transition fires (e.g. inline matches CSS exactly), clean up anyway.
        pendingCleanupTimer = window.setTimeout(cleanup, 350);

        if (shouldOpen !== mobileSidebarOpenRef.current) {
          setMobileSidebarOpen(shouldOpen);
        }
      }
      tracking = null;
      dragging = false;
    };

    // touchmove is the one non-passive listener: it calls preventDefault
    // to hold the page still for the length of a horizontal drag.
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      cancelPendingCleanup();
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
    // Empty dep array — handlers read live state via mobileSidebarOpenRef so
    // we only need to attach the listeners once at mount.
  }, []);

  // The app ships only dark themes (dark, grey, oled — see themeIds in app/core.ts),
  // so the toaster is pinned to "dark" to match. There is no light mode to follow.
  const toaster = <Toaster theme="dark" richColors position="bottom-right" />;

  if (!auth.user) {
    return (
      <>
        <LoginScreen
          loginForm={auth.loginForm}
          loginMutation={auth.loginMutation}
          registerForm={auth.registerForm}
          registerMutation={auth.registerMutation}
          realm={realm}
          onRealmChange={(next) => goToNav(navItemsByRealm[next][0])}
        />
        {toaster}
      </>
    );
  }

  return (
    <>
    <div className={`grid grid-cols-[220px_1fr] h-dvh overflow-hidden transition-[grid-template-columns] duration-[250ms] ease-[ease] max-mobile:grid-cols-1 ${sidebarCollapsed ? "mobile:grid-cols-[62px_1fr]" : ""}`}>
      <Sidebar
        nav={nav}
        onNav={(item) => { goToNav(item); setMobileSidebarOpen(false); }}
        realm={realm}
        onRealmChange={(next) => goToNav(navItemsByRealm[next][0])}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        mobileOpen={mobileSidebarOpen}
      />

      {/* main is the scroll container, not the document: the reading area
          moves and the nav column beside it does not. That needs a real
          height bound — the grid above is the viewport — or main grows to
          fit its content, never overflows, and takes the whole page with
          it when it scrolls. Being the scroller, it is also what the
          mobile drawer has to lock: an overlay does not stop the surface
          under it from scrolling.

          No top padding on mobile: the sticky head supplies its own, and
          padding on the scrollport pushes a sticky top:0 down by that
          much, leaving content sliding through the gap above it. */}
      <main
        ref={mainRef}
        className={`max-w-[1500px] w-full overflow-y-auto overscroll-contain [padding:clamp(20px,4vw,40px)] max-mobile:px-5 max-mobile:pb-5 max-mobile:pt-0 ${mobileSidebarOpen ? "max-mobile:overflow-hidden" : ""}`}
      >
        {/* Mobile head. Sticky, because the menu used to scroll away with
            the page: reaching the nav from the bottom of a long entry
            form meant scrolling back to the top. It bleeds past main's
            padding so the blurred strip reaches both edges. */}
        <header className="hidden max-mobile:grid gap-2 sticky top-0 z-10 -mx-5 mb-5 px-5 py-3 bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] backdrop-blur-md border-b border-[color-mix(in_srgb,var(--border)_40%,transparent)]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="mobile-menu-btn flex items-center justify-center w-[40px] h-[40px] flex-none p-0 border-0 rounded-sm bg-card-soft text-muted cursor-pointer shadow-none hover:text-text hover:bg-card-strong"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <span className="[text-box:trim-both_cap_alphabetic] text-title font-bold tracking-tight text-text truncate">{navLabels[nav]}</span>
          </div>
          {/* Second row, inside the sticky strip: switching view is
              navigation, and navigation must not scroll away. */}
          <div className="flex items-center gap-3">
            {hasEntryViews(nav) ? (
              <EntryViewTabs view={entryView} onChange={setEntryView} labels={entryViewLabels[nav]} className="flex" />
            ) : null}
            <div ref={setHeadSlot} className="ml-auto empty:hidden" />
          </div>
        </header>

        <StageHeadSlot.Provider value={headSlot}>
        <SectionErrorBoundary resetKey={nav}>
        <Suspense fallback={<p className="text-muted text-control">Loading…</p>}>
        {nav === "dashboard" && (
          <DashboardSection
            dashboardFrom={dashboard.dashboardFrom} dashboardTo={dashboard.dashboardTo}
            activeQuickRange={dashboard.activeQuickRange} isLoading={dashboard.isLoading}
            hasEntriesInRange={dashboard.hasEntriesInRange} hasEntriesOverall={dashboard.hasEntriesOverall}
            onDateChange={dashboard.handleDateChange}
            onQuickRange={dashboard.applyQuickRange}
            dashboardCards={dashboard.dashboardCards} dashboardInsights={dashboard.dashboardInsights}
            dashboardConnections={dashboard.dashboardConnections}
            wellbeingSeries={dashboard.wellbeingSeries} graphSelection={dashboard.graphSelection}
            onGraphToggle={dashboard.handleGraphToggle} wellbeingChart={dashboard.wellbeingChart}
            anniversaryCards={memorable.todayItems}
          />
        )}

        {nav === "memorable-days" && <MemorableDaysSection memorable={memorable} />}

        {nav === "diary" && (
          <DiarySection
            view={entryView}
            onViewChange={setEntryView}
            diaryForm={diary.diaryForm} diaryMutationState={{ isSuccess: diary.diaryMutation.isSuccess }} isLoading={diary.isLoading}
            editingDiary={diary.editingDiary} moodFieldOptions={diary.moodFieldOptions}
            diaryEntries={diary.diaryEntries} confirmDeleteDiary={diary.confirmDeleteDiary}
            onSubmit={(v) => diary.diaryMutation.mutate(v)} onCancelEdit={diary.resetDiaryForm}
            onStartEdit={diary.startDiaryEdit} onDeleteClick={diary.onDeleteClick} onDeleteBlur={diary.onDeleteBlur}
          />
        )}

        {nav === "pain" && (
          <PainSection
            view={entryView}
            onViewChange={setEntryView}
            painForm={pain.painForm} painMutationState={{ isSuccess: pain.painMutation.isSuccess }} isLoading={pain.isLoading}
            editingPain={pain.editingPain} painFieldOptions={pain.painFieldOptions}
            watchedValues={pain.watchedValues} painEntries={pain.painEntries}
            confirmDeletePain={pain.confirmDeletePain} onSubmit={(v) => pain.painMutation.mutate(v)}
            onCancelEdit={pain.resetPainForm} onStartEdit={pain.startPainEdit}
            onDeleteClick={pain.onDeleteClick} onDeleteBlur={pain.onDeleteBlur}
          />
        )}

        {nav === "cbt" && (
          <CbtSection
            view={entryView}
            onViewChange={setEntryView}
            cbtForm={cbt.cbtForm} cbtMutationState={{ isSuccess: cbt.cbtMutation.isSuccess }} isLoading={cbt.isLoading}
            editingCbt={cbt.editingCbt} cbtEntries={cbt.cbtEntries}
            confirmDeleteCbt={cbt.confirmDeleteCbt} onSubmit={(v) => cbt.cbtMutation.mutate(v)}
            onCancelEdit={cbt.resetCbtForm} onStartEdit={cbt.startCbtEdit}
            onDeleteClick={cbt.onDeleteClick} onDeleteBlur={cbt.onDeleteBlur}
          />
        )}

        {nav === "dbt" && (
          <DbtSection
            view={entryView}
            onViewChange={setEntryView}
            dbtForm={dbt.dbtForm} dbtMutationState={{ isSuccess: dbt.dbtMutation.isSuccess }} isLoading={dbt.isLoading}
            editingDbt={dbt.editingDbt} dbtEntries={dbt.dbtEntries}
            confirmDeleteDbt={dbt.confirmDeleteDbt} onSubmit={(v) => dbt.dbtMutation.mutate(v)}
            onCancelEdit={dbt.resetDbtForm} onStartEdit={dbt.startDbtEdit}
            onDeleteClick={dbt.onDeleteClick} onDeleteBlur={dbt.onDeleteBlur}
          />
        )}

        {nav === "money-transactions" && (
          <TransactionsSection
            view={entryView}
            onViewChange={setEntryView}
            txForm={moneyTx.txForm} txMutationState={{ isSuccess: moneyTx.txMutation.isSuccess }}
            isLoading={moneyTx.isLoading} editingTx={moneyTx.editingTx}
            transactions={moneyTx.transactions} assetOptions={moneyTx.assetOptions}
            confirmDeleteTx={moneyTx.confirmDeleteTx}
            onSubmit={(v) => moneyTx.txMutation.mutate(v)} onCancelEdit={moneyTx.resetTxForm}
            onStartEdit={moneyTx.startTxEdit} onDeleteClick={moneyTx.onDeleteClick}
            onDeleteBlur={moneyTx.onDeleteBlur} statementImport={moneyTx.statementImport}
          />
        )}

        {nav === "money-movements" && (
          <MovementsSection
            view={entryView}
            onViewChange={setEntryView}
            movementForm={moneyMovements.movementForm}
            movementMutationState={{ isSuccess: moneyMovements.movementMutation.isSuccess }}
            isLoading={moneyMovements.isLoading} editingMovement={moneyMovements.editingMovement}
            movements={moneyMovements.movements} confirmDeleteMovement={moneyMovements.confirmDeleteMovement}
            onSubmit={(v) => moneyMovements.movementMutation.mutate(v)}
            onCancelEdit={moneyMovements.resetMovementForm} onStartEdit={moneyMovements.startMovementEdit}
            onDeleteClick={moneyMovements.onDeleteClick} onDeleteBlur={moneyMovements.onDeleteBlur}
          />
        )}

        {nav === "money-snapshots" && (
          <SnapshotsSection
            view={entryView}
            onViewChange={setEntryView}
            snapshotForm={moneySnapshots.snapshotForm}
            snapshotMutationState={{ isSuccess: moneySnapshots.snapshotMutation.isSuccess }}
            isLoading={moneySnapshots.isLoading} canSave={moneySnapshots.canSave}
            assetsMissingRisk={moneySnapshots.assetsMissingRisk}
            snapshots={moneySnapshots.snapshots} confirmDeleteSnapshot={moneySnapshots.confirmDeleteSnapshot}
            onSubmit={(v) => moneySnapshots.snapshotMutation.mutate(v)}
            onDeleteClick={moneySnapshots.onDeleteClick} onDeleteBlur={moneySnapshots.onDeleteBlur}
          />
        )}

        {nav === "money-dashboard" && <MoneyDashboardSection {...moneyDashboard} />}

        {realm === "settings" && (
          <SettingsSection nav={nav} money={moneySettings} auth={auth}
            purgeConfirmArmed={settings.purgeConfirmArmed}
            purgePending={settings.purgePending} purgeError={settings.purgeError}
            onPurgeArm={settings.onPurgeArm} onPurgeConfirm={settings.onPurgeConfirm}
            onPurgeCancel={settings.onPurgeCancel} onExportJson={settings.onExportJson}
            onImportJson={settings.onImportJson} onExportXlsx={settings.onExportXlsx}
            onImportXlsx={settings.onImportXlsx}
          />
        )}

        </Suspense>
        </SectionErrorBoundary>
        </StageHeadSlot.Provider>
      </main>
    </div>
    {toaster}
    </>
  );
}

export default App;
