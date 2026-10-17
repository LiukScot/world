import { lazy, Suspense } from "react";
import { navLabels, type InlineMessage, type NavItem } from "./core";
import { SettingsScreen } from "./SettingsPanel";
import { PAGE_TITLE } from "./screen-helpers";
import type { MoneySettingsProps } from "./money/MoneySettings";

const DesignSystemSection = lazy(() =>
  import("./DesignSystemSection").then((m) => ({ default: m.DesignSystemSection })),
);

export function SettingsSection({
  nav,
  money,
  ...rest
}: {
  nav: NavItem;
  money: MoneySettingsProps;
  purgeConfirmArmed: boolean;
  purgePending: boolean;
  purgeError: InlineMessage | null;
  onPurgeArm: () => void;
  onPurgeConfirm: () => void;
  onPurgeCancel: () => void;
}) {
  // The design system is a page of its own rather than a settings form, and
  // it is the heaviest thing in the realm, so it stays lazy.
  if (nav === "settings-design-system") {
    return (
      <Suspense fallback={<p className="text-muted text-control">Loading…</p>}>
        <DesignSystemSection />
      </Suspense>
    );
  }

  return (
    <section className="@container">
      <h1 className={`${PAGE_TITLE} mb-page`}>{navLabels[nav]}</h1>
      <div className="max-w-[80ch]">
        <SettingsScreen nav={nav} money={money} {...rest} />
      </div>
    </section>
  );
}
