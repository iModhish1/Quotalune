/**
 * Hybrid Dashboard -- Dev-only placeholder for Phase 2.
 *
 * A future Hybrid mode is a purpose-built composition (a small 3D provider
 * hero + selected analytics widgets), never the full 2D dashboard plus a
 * fake 3D scene mounted together. That composition depends on both
 * `AnalyticsDashboard` and a real `Providers3DDashboard` existing first
 * (Phases 3 and 5/6) -- this placeholder only proves the routing contract.
 */
import type { DashboardModeProps } from "../../lib/dashboardRegistry";
import { useDashboardSnapshot } from "../../hooks/useDashboardSnapshot";
import "./DashboardPlaceholder.css";

export default function HybridDashboard(_props: DashboardModeProps) {
  const { snapshot, isLoading } = useDashboardSnapshot("last30Days");

  return (
    <div className="dashboard-placeholder">
      <h3>Hybrid Dashboard</h3>
      <p>
        Analytics + spatial provider context will be implemented once both the 2D redesign and the
        3D engine exist (development build only).
      </p>
      {!isLoading && snapshot && (
        <dl className="dashboard-placeholder__facts">
          <div>
            <dt>Real history samples</dt>
            <dd>{snapshot.availability.sampleCount.toLocaleString()}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
