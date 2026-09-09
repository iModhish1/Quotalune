/**
 * Spatial Observatory Dashboard mode -- Phase S1 prototype.
 *
 * Consumes the SAME effective data every other Dashboard surface uses
 * (`useEffectiveProviders`/`useSettings`) -- real provider data by
 * default, or the exact same user-accessible Demo Mode dataset the 2D
 * and 3D surfaces already use (owner section 16: "Demo Mode is the
 * golden state"). `DASHBOARD_REGISTRY.spatial.isPlaceholder` stays
 * `true`: this is an explicit prototype for owner comparison against
 * Experimental 3D, not a declared production default (owner section 37).
 */
import { useMemo } from "react";
import { useEffectiveProviders } from "../../hooks/useEffectiveProviders";
import { useSettings } from "../../hooks/useSettings";
import { resolveCatalogTheme } from "../../design-system/themeResolution";
import { CANONICAL_THEME, catalogBySlug } from "../../design-system/themeCatalog";
import SpatialObservatoryScene from "./spatial/SpatialObservatoryScene";
import type { DashboardModeProps } from "../../lib/dashboardRegistry";

export default function SpatialDashboard({ state, onOpenProviders }: DashboardModeProps) {
  const { settings, update } = useSettings(state.settings);
  const { providers, provenance } = useEffectiveProviders(settings, state.providers);
  const { slug } = resolveCatalogTheme(settings, "spatial");
  const theme = catalogBySlug(slug) ?? CANONICAL_THEME;

  // Same filtering rule as Providers3DDashboard (owner section 14: one
  // truth layer, not a second one) -- live data is scoped to the active
  // profile's enabled providers; Demo Mode's synthetic set never is.
  const visibleProviders = useMemo(() => {
    if (provenance === "demo") return providers;
    const enabled = new Set(settings.enabledProviders);
    return providers.filter((p) => enabled.has(p.providerId));
  }, [providers, provenance, settings.enabledProviders]);

  return (
    <SpatialObservatoryScene
      liveProviders={visibleProviders}
      settings={settings}
      theme={theme}
      provenance={provenance}
      onOpenProviders={onOpenProviders}
      onExitDemo={() => update({ demoModeEnabled: false })}
    />
  );
}
