import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BootstrapState, ProviderUsageSnapshot, SettingsSnapshot } from "../types/bridge";
import { reorderProviders } from "../lib/tauri";
import { orderProviderSnapshots } from "../lib/providerOrder";

/**
 * Shared provider-ordering/selection/scroll-to-card state for every surface
 * that renders the Dashboard (`DashboardBody.tsx`) -- the in-shell Settings
 * tab and the detached "Open Dashboard in Separate Window" surface. Neither
 * surface reimplements this logic; only their window chrome differs.
 */
export function useDashboardState({
  providers,
  bootstrapProviders,
  settings,
  deepLinkProviderId,
  bypassEnabledFilter,
}: {
  providers: ProviderUsageSnapshot[];
  bootstrapProviders: BootstrapState["providers"];
  settings: SettingsSnapshot;
  deepLinkProviderId?: string;
  /** Phase 5.2: Demo Mode's synthetic providers are never a subset of the
   *  real profile's `enabledProviders` (owner section 19) -- filtering
   *  them by it would wipe out the whole demo dataset. Callers pass
   *  `true` here when `providers` came from `useEffectiveProviders()`
   *  with `provenance === "demo"`; real (live) data always goes through
   *  the filter as before. */
  bypassEnabledFilter?: boolean;
}) {
  // `orderProviderSnapshots` only SORTS -- it ranks a disabled/stale
  // provider to the end but never excludes it. `providers` itself
  // (from `useProviders()`) is not scoped to the active profile's
  // account set either: it reflects the backend's global provider
  // cache, which a profile switch does not clear or re-filter. Without
  // this filter, switching to a profile with a different (or empty)
  // `enabledProviders` list left the Dashboard showing the previous
  // profile's providers -- the same real bug found and fixed for the 3D
  // Dashboard (`Providers3DDashboard.tsx`); see
  // docs/validation/PHASE5_3D_PROTOTYPE.md for the original
  // investigation. `FloatBar.tsx`/`useTrayPanelController.ts` already
  // filter by `enabledProviders` at their own point of use -- this hook
  // is the shared point of use for every Dashboard surface
  // (`AnalyticsDashboard.tsx`, `PopOutPanel.tsx`), so filtering fixes
  // both at once.
  const enabledProviders = useMemo(() => {
    if (bypassEnabledFilter) return providers;
    const enabled = new Set(settings.enabledProviders);
    return providers.filter((p) => enabled.has(p.providerId));
  }, [providers, settings.enabledProviders, bypassEnabledFilter]);

  const sorted = useMemo(
    () =>
      orderProviderSnapshots(
        enabledProviders,
        bootstrapProviders,
        settings.enabledProviders,
        settings.providerOrder,
      ),
    [enabledProviders, bootstrapProviders, settings.enabledProviders, settings.providerOrder],
  );

  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    deepLinkProviderId ?? null,
  );
  const [gridExpanded, setGridExpanded] = useState(false);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    setSelectedProviderId(deepLinkProviderId ?? null);
  }, [deepLinkProviderId]);

  const visibleProviders = useMemo(() => {
    if (selectedProviderId === null) {
      if (sorted.length + 1 > 32 && !gridExpanded) {
        return sorted.slice(0, 4);
      }
      return sorted;
    }
    const match = sorted.find((p) => p.providerId === selectedProviderId);
    return match ? [match] : sorted;
  }, [sorted, selectedProviderId, gridExpanded]);

  const providerOrderKey = useMemo(
    () => sorted.map((provider) => provider.providerId).join(","),
    [sorted],
  );

  const handleGridClick = useCallback((nextProviderId: string | null) => {
    setSelectedProviderId(nextProviderId);
  }, []);
  const handleReorder = useCallback((orderedIds: string[]) => {
    void reorderProviders(orderedIds).catch(() => {});
  }, []);

  const setCardRef = useCallback((providerId: string, node: HTMLDivElement | null) => {
    if (node) cardRefs.current.set(providerId, node);
    else cardRefs.current.delete(providerId);
  }, []);

  useEffect(() => {
    if (!deepLinkProviderId || selectedProviderId !== deepLinkProviderId || providerOrderKey.length === 0) return;

    let cancelled = false;
    const scrollToProvider = () => {
      if (cancelled) return;
      const target = cardRefs.current.get(deepLinkProviderId);
      if (!target) return;

      window.scrollTo(0, 0);
      if (document.scrollingElement) {
        document.scrollingElement.scrollTop = 0;
      }
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      for (const selector of [".menu-stack", ".menu-surface__body"]) {
        const container = target.closest<HTMLElement>(selector);
        if (!container) continue;
        container.scrollTop = 0;
        const targetRect = target.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        container.scrollTop += targetRect.top - containerRect.top;
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToProvider);
    });
    const timer = window.setTimeout(scrollToProvider, 100);
    const lateTimer = window.setTimeout(scrollToProvider, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(lateTimer);
    };
  }, [deepLinkProviderId, selectedProviderId, providerOrderKey]);

  return {
    sorted,
    visibleProviders,
    selectedProviderId,
    gridExpanded,
    setGridExpanded,
    handleGridClick,
    handleReorder,
    setCardRef,
  };
}
