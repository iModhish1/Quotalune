import { Fragment } from "react";
import type { SettingsSnapshot } from "../types/bridge";
import type { StageProvider } from "./orbit/stageTypes";
import MenuCard from "./MenuCard";
import { MenuEmpty } from "./MenuSurface";
import ProviderGrid from "./ProviderGrid";
import CatalogUsageHero from "./CatalogUsageHero";
import DashboardSummaryRibbon from "./DashboardSummaryRibbon";
import type { ProviderUsageSnapshot } from "../types/bridge";

/**
 * The actual Dashboard content -- provider switcher grid, the orbital
 * usage hero, and the full provider-card stack. Shared by every surface
 * that renders the Dashboard: the in-shell Settings tab (`DashboardTab.tsx`)
 * and the detached "Open Dashboard in Separate Window" surface
 * (`PopOutPanel.tsx`). Neither surface duplicates this layout -- window
 * chrome (title bar, footer actions, zoom scaling, keyboard shortcuts) is
 * each surface's own concern, not this component's.
 */
export default function DashboardBody({
  allProviders,
  visibleProviders,
  stageProviders,
  isRefreshing,
  hasCachedData,
  refreshingProviderIds,
  selectedProviderId,
  gridExpanded,
  onExpandedChange,
  onSelect,
  onReorder,
  catalog,
  settings,
  onSettings,
  cardRef,
  hideHero,
}: {
  /** Every provider, in display order -- feeds the switcher grid and the
   *  orbital hero, which always show the full set regardless of selection. */
  allProviders: ProviderUsageSnapshot[];
  /** Just the selected provider (or the full set when nothing is selected)
   *  -- feeds the card stack below the hero. */
  visibleProviders: ProviderUsageSnapshot[];
  stageProviders: StageProvider[];
  isRefreshing: boolean;
  hasCachedData: boolean;
  refreshingProviderIds: ReadonlySet<string>;
  selectedProviderId: string | null;
  gridExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onSelect: (providerId: string | null) => void;
  onReorder: (orderedIds: string[]) => void;
  catalog: string;
  settings: SettingsSnapshot;
  onSettings: () => void;
  cardRef: (providerId: string, node: HTMLDivElement | null) => void;
  /** Skip the orbital usage hero. The 2D Analytics Dashboard mode uses
   *  this -- a full 3D-style orbital centerpiece is exactly the "giant
   *  empty orbital hero" the Phase 3 spec says 2D must not show, now that
   *  the real analytics rows (KPIs, trend, distribution) are the primary
   *  content. `PopOutPanel`'s detached window keeps the hero (unaffected,
   *  defaults to `false`). */
  hideHero?: boolean;
}) {
  if (allProviders.length === 0) {
    return <MenuEmpty isLoading={isRefreshing && !hasCachedData} onSettings={onSettings} />;
  }

  return (
    <>
      <DashboardSummaryRibbon providers={allProviders} settings={settings} />
      <ProviderGrid
        providers={allProviders}
        selectedProviderId={selectedProviderId}
        showAsUsed={settings.showAsUsed}
        showProviderIcons={settings.switcherShowsIcons}
        expanded={gridExpanded}
        onExpandedChange={onExpandedChange}
        onSelect={onSelect}
        onReorder={onReorder}
      />
      {!hideHero && (
        <CatalogUsageHero
          variant="dashboard"
          catalog={catalog}
          providers={stageProviders}
          selectedProviderId={selectedProviderId}
          onSelectProvider={(providerId) => onSelect(providerId)}
          showProviderIcons={settings.switcherShowsIcons}
        />
      )}
      <div className="provider-grid__divider" />
      <div className="menu-stack">
        {visibleProviders.map((p, idx) => (
          <Fragment key={p.providerId}>
            {idx > 0 && <div className="menu-stack__sep" />}
            <div
              className={`menu-stack__item${selectedProviderId === p.providerId ? " menu-stack__item--selected" : ""}`}
              ref={(node) => cardRef(p.providerId, node)}
            >
              <MenuCard
                provider={p}
                isRefreshing={refreshingProviderIds.has(p.providerId)}
                display={{
                  hideEmail: settings.hidePersonalInfo,
                  resetTimeRelative: settings.resetTimeRelative,
                  showResetWhenExhausted: settings.showResetWhenExhausted,
                  showPace: settings.showPace ?? true,
                  showAsUsed: settings.showAsUsed,
                  compactMetrics: selectedProviderId === null,
                  costSummaryDisplayStyle: settings.costSummaryDisplayStyle,
                }}
                accentColor={settings.providerAccentColors[p.providerId]}
              />
            </div>
          </Fragment>
        ))}
      </div>
    </>
  );
}
