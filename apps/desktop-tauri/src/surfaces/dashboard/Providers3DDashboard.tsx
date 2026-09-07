/**
 * 3D Providers Dashboard -- Dev-only placeholder for Phase 2.
 *
 * No Three.js/WebGL dependency exists in this codebase yet (confirmed in
 * the Phase 0 audit) -- the real 3D engine is explicitly a later phase
 * (Phase 5/6), never started here. This placeholder exists only to prove
 * `DashboardHost`'s mount/dispose contract works for a mode that isn't
 * `analytics2d`, using the real `DashboardSnapshot` (never synthetic data)
 * for the one honest thing it can show: how much real history exists.
 *
 * Never shown to a Personal/production user as a finished feature --
 * `DASHBOARD_REGISTRY.providers3d.isPlaceholder` is `true` and Dashboard
 * Studio's UI must say so explicitly.
 */
import type { DashboardModeProps } from "../../lib/dashboardRegistry";
import { useDashboardSnapshot } from "../../hooks/useDashboardSnapshot";
import "./DashboardPlaceholder.css";

export default function Providers3DDashboard(_props: DashboardModeProps) {
  const { snapshot, isLoading } = useDashboardSnapshot("last30Days");

  return (
    <div className="dashboard-placeholder">
      <h3>3D Providers Dashboard</h3>
      <p>The 3D engine will be implemented in a later phase (development build only).</p>
      {!isLoading && snapshot && (
        <dl className="dashboard-placeholder__facts">
          <div>
            <dt>Real history samples</dt>
            <dd>{snapshot.availability.sampleCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Providers with history</dt>
            <dd>{new Set(snapshot.providers.map((p) => p.provider)).size}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
