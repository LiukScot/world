import { navItemsByRealm, navLabels, realmLabels, realms, type NavItem, type Realm } from "./core";

// .sidebar / .sidebar-close-btn / .mobile-menu-btn keep their class names: the
// shell's focus-trap + swipe handlers query them. Styling moves to utilities;
// collapse/mobile state is driven by props (desktop collapse gated behind
// the mobile: breakpoint, the mobile drawer behind max-mobile:).
export const NAV_ITEM =
  "flex items-center gap-3 w-full p-3 border border-transparent rounded-sm font-[inherit] text-sm font-semibold cursor-pointer transition-all whitespace-nowrap overflow-hidden shadow-none [&>svg]:flex-shrink-0 [&>svg]:w-5 [&>svg]:h-5 max-mobile:p-[14px_12px] max-mobile:text-base max-mobile:[&>svg]:w-[22px] max-mobile:[&>svg]:h-[22px]";
export const NAV_ITEM_IDLE = "text-muted bg-transparent hover:text-text hover:bg-card-strong";
export const NAV_ITEM_ACTIVE = "text-accent bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]";
const NAV_LABEL = "opacity-100 transition-opacity";

// Square realm tiles that replace the old Design System footer button. Active
// state is signalled by accent colour *and* a solid border (never colour
// alone), plus aria-pressed for screen readers.
const REALM_TILE =
  "flex items-center justify-center w-11 h-11 shrink-0 rounded-sm border cursor-pointer transition-all shadow-none [&>svg]:w-5 [&>svg]:h-5 max-mobile:w-12 max-mobile:h-12 max-mobile:[&>svg]:w-[22px] max-mobile:[&>svg]:h-[22px]";
const REALM_TILE_ACTIVE = "border-accent text-accent bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]";
const REALM_TILE_IDLE = "border-transparent text-muted bg-card-soft hover:text-text hover:bg-card-strong";

const dashboardIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
);

const settingsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
);

const realmIconHealth = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
);
const realmIconMoney = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><path d="M17 13h.01"/></svg>
);

// One icon per realm: used by the sidebar header, the switcher tiles, and —
// for Health and Money — by their section inside the Settings realm.
const realmIcons: Record<Realm, React.ReactNode> = {
  health: realmIconHealth,
  money: realmIconMoney,
  settings: settingsIcon,
};

const navIcons: Record<NavItem, React.ReactNode> = {
  dashboard: dashboardIcon,
  "money-dashboard": dashboardIcon,
  "settings-account": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  ),
  "settings-appearance": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"/></svg>
  ),
  "settings-health": realmIconHealth,
  "settings-money": realmIconMoney,
  "settings-design-system": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2a10 10 0 0 0 0 20 2 2 0 0 0 2-2v-1a2 2 0 0 1 2-2h1a4 4 0 0 0 4-4 10 10 0 0 0-9-11z"/></svg>
  ),
  "money-transactions": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>
  ),
  "money-movements": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m17 5-5-3-5 3"/><path d="M12 2v20"/><path d="m7 19 5 3 5-3"/></svg>
  ),
  "money-snapshots": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
  ),
  "memorable-days": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>
  ),
  pain: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z"/></svg>
  ),
  diary: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
  ),
  cbt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 18V5"/><path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"/><path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5"/><path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"/><path d="M18 18a4 4 0 0 0 2-7.464"/><path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"/><path d="M6 18a4 4 0 0 1-2-7.464"/><path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"/></svg>
  ),
  dbt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/><path d="M7 3.5c.5-.8 1.5-.8 2 0"/><path d="M15 3.5c.5-.8 1.5-.8 2 0"/></svg>
  ),
};

type SidebarProps = {
  nav: NavItem;
  onNav: (item: NavItem) => void;
  realm: Realm;
  onRealmChange: (realm: Realm) => void;
  collapsed: boolean;
  onToggle: () => void;
  onCloseMobile: () => void;
  mobileOpen: boolean;
};

/*
 * The realm tiles. Lives here because the icons do, and is shared with the
 * login screen: picking a realm before signing in is the same choice as
 * switching once you are in, and the accent + stored realm follow either
 * way — so after login you land where you pointed.
 */
export function RealmSwitcher({
  realm,
  onChange,
  className = "",
  options = realms,
}: {
  realm: Realm;
  onChange: (next: Realm) => void;
  className?: string;
  /** Narrows the tiles. The login screen drops Settings: it is somewhere you
      go to change something, not somewhere to open the app into. */
  options?: readonly Realm[];
}) {
  return (
    <div className={`flex gap-2 ${className}`} role="group" aria-label="Switch app">
      {options.map((id) => (
        <button
          key={id}
          type="button"
          className={`${REALM_TILE} ${id === realm ? REALM_TILE_ACTIVE : REALM_TILE_IDLE}`}
          onClick={() => onChange(id)}
          aria-pressed={id === realm}
          aria-label={realmLabels[id]}
          title={realmLabels[id]}
        >
          {realmIcons[id]}
        </button>
      ))}
    </div>
  );
}

export function Sidebar({ nav, onNav, realm, onRealmChange, collapsed, onToggle, onCloseMobile, mobileOpen }: SidebarProps) {
  const items = navItemsByRealm[realm];

  return (
    <aside
      className={`sidebar h-full min-h-0 overflow-y-auto flex flex-col bg-bg border-r border-border px-2 py-3 gap-2 z-10 max-mobile:fixed max-mobile:inset-0 max-mobile:border-r-0 max-mobile:w-full max-mobile:h-[100dvh] max-mobile:p-[14px_18px] max-mobile:pt-[calc(14px+env(safe-area-inset-top))] max-mobile:pb-[calc(14px+env(safe-area-inset-bottom))] max-mobile:[scrollbar-width:none] max-mobile:[&::-webkit-scrollbar]:hidden max-mobile:z-[100] max-mobile:transition-transform max-mobile:duration-[250ms] max-mobile:ease-[ease] ${mobileOpen ? "max-mobile:[transform:translateX(0)]" : "max-mobile:[transform:translateX(-100%)]"}`}
      aria-label="Main navigation"
      {...(mobileOpen ? { role: "dialog", "aria-modal": true } : {})}
    >
      <div className={`flex items-center gap-3 pt-1 px-2 pb-3 border-b border-border mb-2 min-h-[48px] overflow-hidden ${collapsed ? "mobile:justify-center mobile:gap-0 mobile:px-0" : ""}`}>
        <span className={`flex-shrink-0 text-accent transition-all duration-200 [&>svg]:w-[26px] [&>svg]:h-[26px] ${collapsed ? "mobile:w-0 mobile:opacity-0 mobile:overflow-hidden" : ""}`}>
          {realmIcons[realm]}
        </span>
        <span className={`text-xl font-bold tracking-tight whitespace-nowrap flex-1 min-w-0 overflow-hidden opacity-100 transition-opacity duration-200 ${collapsed ? "mobile:opacity-0 mobile:flex-[0]" : ""}`}>{realmLabels[realm]}</span>
        <button className="flex-shrink-0 flex items-center justify-center w-8 h-8 p-0 border-0 rounded-[8px] bg-transparent text-muted cursor-pointer transition-all shadow-none hover:text-text [&>svg]:w-5 [&>svg]:h-5 max-mobile:hidden" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
        </button>
        <button className="sidebar-close-btn hidden max-mobile:flex items-center justify-center flex-shrink-0 w-9 h-9 p-0 border-0 rounded-[8px] bg-transparent text-muted cursor-pointer shadow-none hover:text-text [&>svg]:w-5 [&>svg]:h-5" onClick={onCloseMobile} aria-label="Close menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <nav className="flex flex-col gap-1 flex-1 min-h-0" aria-label="Sections">
        {items.map((item) => (
          <button
            key={item}
            className={`${NAV_ITEM} ${nav === item ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE}`}
            // The active item was marked by tint alone, which a screen
            // reader cannot see.
            aria-current={nav === item ? "page" : undefined}
            onClick={() => onNav(item)}
            title={collapsed ? navLabels[item] : undefined}
          >
            {navIcons[item]}
            <span className={`${NAV_LABEL} ${collapsed ? "mobile:opacity-0 mobile:w-0" : ""}`}>{navLabels[item]}</span>
          </button>
        ))}
      </nav>

      <RealmSwitcher
        realm={realm}
        onChange={onRealmChange}
        className={`flex-shrink-0 pt-5 mt-2 border-t border-border ${collapsed ? "mobile:flex-col mobile:items-center" : ""}`}
      />
    </aside>
  );
}
