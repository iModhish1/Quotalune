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
}: {
  providers: ProviderUsageSnapshot[];
  bootstrapProviders: BootstrapState["providers"];
  settings: SettingsSnapshot;
  deepLinkProviderId?: string;
}) {
  const sorted = useMemo(
    () =>
      orderProviderSnapshots(
        providers,
        bootstrapProviders,
        settings.enabledProviders,
        settings.providerOrder,
      ),
    [providers, bootstrapProviders, settings.enabledProviders, settings.providerOrder],
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
