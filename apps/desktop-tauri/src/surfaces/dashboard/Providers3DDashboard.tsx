/**
 * 3D Providers Dashboard -- Phase 5 prototype, Phase 5.2 Demo Mode.
 *
 * Consumes the SAME effective data every other Dashboard surface uses
 * (`useEffectiveProviders`/`useSettings`) -- real provider data by
 * default, or a fully synthetic, clearly-labelled dataset when the
 * user-accessible Demo Mode setting is on (owner Phase 5.2 section 0/18).
 * `DASHBOARD_REGISTRY.providers3d.isPlaceholder` stays `true`: this is an
 * explicit prototype, not the final production 3D Dashboard, per
 * `docs/validation/PHASE5_3D_PROTOTYPE.md`'s scope.
 *
 * A DEV-only lab (`Providers3DDevLab`) exists separately for fixture-
 * driven engineering stress testing (owner Phase 5 section 56/57) --
 * distinct from this user-facing Demo Mode (owner Phase 5.2 section 61).
 */
import { useMemo } from "react";
import { useEffectiveProviders } from "../../hooks/useEffectiveProviders";
import { useSettings } from "../../hooks/useSettings";
import { resolveCatalogTheme } from "../../design-system/themeResolution";
import { CANONICAL_THEME, catalogBySlug } from "../../design-system/themeCatalog";
import ProvidersUniverseScene from "./providers3d/ProvidersUniverseScene";
import type { DashboardModeProps } from "../../lib/dashboardRegistry";

export default function Providers3DDashboard({ state, onOpenProviders, onSwitchToAnalytics2D }: DashboardModeProps) {
  const { settings, update } = useSettings(state.settings);
  const { providers, provenance } = useEffectiveProviders(settings, state.providers);
  const { slug } = resolveCatalogTheme(settings, "providers3d");
  const theme = catalogBySlug(slug) ?? CANONICAL_THEME;

  // `useProviders()` (live mode) returns whatever the backend's global
  // provider cache holds, which is NOT scoped to the active profile's
  // account set -- switching to a profile with a different (or empty)
  // `enabledProviders` list does not clear or re-filter that cache. Every
  // other real surface that renders a provider list already filters by
  // `enabledProviders` at the point of use (see `FloatBar.tsx`,
  // `useTrayPanelController.ts`). This filter only applies to real data:
  // Demo Mode's synthetic providers are never a subset of the real
  // profile's account membership, so filtering them by it would (almost
  // always) wipe out the whole demo dataset (owner Phase 5.2 section 19:
  // Demo Mode must never pretend real account membership includes it).
  const visibleProviders = useMemo(() => {
    if (provenance === "demo") return providers;
    const enabled = new Set(settings.enabledProviders);
    return providers.filter((p) => enabled.has(p.providerId));
  }, [providers, provenance, settings.enabledProviders]);

  return (
    <ProvidersUniverseScene
      liveProviders={visibleProviders}
      settings={settings}
      theme={theme}
      provenance={provenance}
      onOpenProviders={onOpenProviders}
      onSwitchToAnalytics2D={onSwitchToAnalytics2D}
      onExitDemo={() => update({ demoModeEnabled: false })}
    />
  );
}
