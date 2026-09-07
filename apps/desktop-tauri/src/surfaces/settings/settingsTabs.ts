import type { BootstrapState, SettingsTabId, SettingsUpdate } from "../../types/bridge";
import type { LocaleKey } from "../../i18n/keys";

// Ordered by the Wave 6 navigation hierarchy — Dashboard first (a real
// settings tab, rendered with its own distinct icon and position in
// Settings.tsx's tab bar, but a normal tab in every other respect — its
// content, validity, and persistence all go through this same list), then
// the rest of primary product surfaces, then organization, then
// customization, then system/config tabs last. "General", "Menu Bar",
// "Menu", and "Surfaces" aren't named in that hierarchy explicitly; they're
// treated as system/config tabs alongside Advanced rather than invented a
// new visual grouping for (that's a Phase 7 density-pass concern, not a
// Phase 3 navigation-order concern).
export const TAB_META: { id: SettingsTabId; labelKey: LocaleKey }[] = [
  // Primary product
  { id: "dashboard", labelKey: "TabDashboard" },
  { id: "providerDisplay", labelKey: "TabProviderDisplay" },
  { id: "collections", labelKey: "TabCollections" },
  // Organization
  { id: "profiles", labelKey: "TabProfiles" },
  { id: "providers", labelKey: "TabProviders" },
  // Customization
  { id: "themes", labelKey: "TabThemes" },
  // Its own first-class destination, not a sub-view switcher pill inside
  // Provider Display (the owner explicitly rejected that placement).
  { id: "resetDisplay", labelKey: "TabResetDisplay" },
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
