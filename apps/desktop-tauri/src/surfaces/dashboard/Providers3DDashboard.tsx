/**
 * 3D Providers Dashboard -- Phase 5 prototype.
 *
 * Consumes the SAME real data every other Dashboard surface uses
 * (`useProviders`/`useSettings`) -- never synthetic data (owner Phase 5
 * section 0). `DASHBOARD_REGISTRY.providers3d.isPlaceholder` stays `true`:
 * this is an explicit prototype, not the final production 3D Dashboard,
 * per `docs/validation/PHASE5_3D_PROTOTYPE.md`'s scope.
 *
 * A DEV-only lab (`Providers3DDevLab`) exists separately for fixture-
 * driven stress testing (owner section 56/57) -- this component itself
 * never renders fixture data as if it were real.
 */
import { useMemo } from "react";
import { useProviders } from "../../hooks/useProviders";
import { useSettings } from "../../hooks/useSettings";
import { resolveCatalogTheme } from "../../design-system/themeResolution";
import { CANONICAL_THEME, catalogBySlug } from "../../design-system/themeCatalog";
import ProvidersUniverseScene from "./providers3d/ProvidersUniverseScene";
import type { DashboardModeProps } from "../../lib/dashboardRegistry";

export default function Providers3DDashboard({ state, onOpenProviders, onSwitchToAnalytics2D }: DashboardModeProps) {
  const { providers } = useProviders();
  const { settings } = useSettings(state.settings);
  const { slug } = resolveCatalogTheme(settings, "providers3d");
  const theme = catalogBySlug(slug) ?? CANONICAL_THEME;

  // `useProviders()` returns whatever the backend's global provider cache
  // holds, which is NOT scoped to the active profile's account set --
  // switching to a profile with a different (or empty) `enabledProviders`
  // list does not clear or re-filter that cache. Every other real surface
  // that renders a provider list already filters by `enabledProviders` at
  // the point of use (see `FloatBar.tsx`, `useTrayPanelController.ts`) --
  // this component didn't, so a profile switch left it showing the
  // previous profile's providers even after the `useProviders()` fix for
  // the missing "quotalis:settings-updated" listener. Found via real
  // native CDP proof (Phase 5.1 follow-up); see
  // docs/validation/PHASE5_3D_PROTOTYPE.md.
  const visibleProviders = useMemo(() => {
    const enabled = new Set(settings.enabledProviders);
    return providers.filter((p) => enabled.has(p.providerId));
  }, [providers, settings.enabledProviders]);

  return (
    <ProvidersUniverseScene
      liveProviders={visibleProviders}
      settings={settings}
      theme={theme}
      onOpenProviders={onOpenProviders}
      onSwitchToAnalytics2D={onSwitchToAnalytics2D}
    />
  );
}
