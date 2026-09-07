import type { BootstrapState, SettingsTabId, SettingsUpdate } from "../../types/bridge";
import type { LocaleKey } from "../../i18n/keys";

// Ordered by the Wave 6 Phase 3 navigation hierarchy — primary product
// surfaces first (Dashboard itself is not a tab; it's the separate button
// rendered before this list in Settings.tsx), then organization, then
// customization, then system/config tabs last. "General", "Menu Bar",
// "Menu", and "Surfaces" aren't named in that hierarchy explicitly; they're
// treated as system/config tabs alongside Advanced rather than invented a
// new visual grouping for (that's a Phase 7 density-pass concern, not a
// Phase 3 navigation-order concern).
export const TAB_META: { id: SettingsTabId; labelKey: LocaleKey }[] = [
  // Primary product
  { id: "providerDisplay", labelKey: "TabProviderDisplay" },
  { id: "collections", labelKey: "TabCollections" },
  // Organization
  { id: "profiles", labelKey: "TabProfiles" },
  { id: "providers", labelKey: "TabProviders" },
  // Customization
  { id: "themes", labelKey: "TabThemes" },
  { id: "usageSpend", labelKey: "TabUsageSpend" },
  { id: "notifications", labelKey: "TabNotifications" },
  // System / configuration
  { id: "general", labelKey: "TabGeneral" },
  { id: "menuBar", labelKey: "TabMenuBar" },
  { id: "menu", labelKey: "TabMenu" },
  { id: "surfaces", labelKey: "TabSurfaces" },
  { id: "advanced", labelKey: "TabAdvanced" },
  { id: "about", labelKey: "TabAbout" },
];

export interface TabProps {
  settings: BootstrapState["settings"];
  set: (p: SettingsUpdate) => void;
  saving: boolean;
}

export function isSettingsTab(value: string): value is SettingsTabId {
  return TAB_META.some((t) => t.id === value);
}
