/**
 * Dashboard — the in-shell, first-class Settings destination.
 *
 * Delegates to `DashboardHost`, which mounts exactly the Dashboard mode
 * the user selected in Dashboard Studio (`dashboardMode` setting) --
 * `analytics2d` (the real, pre-existing Dashboard content) by default, or
 * a Phase 2 Dev placeholder for `providers3d`/`hybrid`.
 */
import { useCallback } from "react";
import type { BootstrapState } from "../../../types/bridge";
import { useSettings } from "../../../hooks/useSettings";
import DashboardHost from "../../dashboard/DashboardHost";

export default function DashboardTab({
  state,
  onOpenProviders,
}: {
  state: BootstrapState;
  onOpenProviders: () => void;
}) {
  const { settings, update } = useSettings(state.settings);
  const onSwitchToDefault = useCallback(() => {
    void update({ dashboardMode: "analytics2d" });
  }, [update]);

  return (
    <DashboardHost
      mode={settings.dashboardMode}
      state={state}
      onOpenProviders={onOpenProviders}
      onSwitchToDefault={onSwitchToDefault}
    />
  );
}
