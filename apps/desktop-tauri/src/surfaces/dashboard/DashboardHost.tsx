/**
 * DashboardHost -- mounts exactly ONE Dashboard mode at a time.
 *
 * This is the single place that actually renders a `DashboardDefinition`'s
 * `loader`. Switching `mode` unmounts the previous mode (React disposes
 * its state/effects/subscriptions) and lazily mounts the new one -- the
 * inactive mode's module is never even requested until its mode is
 * selected (see `dashboardRegistry.ts`'s `React.lazy` loaders), so
 * `analytics2d` never pulls in a future 3D engine's code, and switching to
 * `providers3d` doesn't keep the 2D dashboard alive in the background.
 *
 * Each mode is wrapped in its own error boundary: a mode that fails to
 * render never takes the rest of QuotaArc down with it, and offers an
 * explicit "Switch to 2D Analytics" recovery action.
 */
import { Component, Suspense, type ReactNode } from "react";
import type { BootstrapState, DashboardModeId } from "../../types/bridge";
import { DASHBOARD_REGISTRY, resolveDashboardMode } from "../../lib/dashboardRegistry";
import "./DashboardHost.css";

function DashboardHostSkeleton() {
  return (
    <div className="dashboard-host__skeleton" role="status" aria-label="Loading Dashboard">
      <div className="dashboard-host__skeleton-bar" />
      <div className="dashboard-host__skeleton-bar" />
      <div className="dashboard-host__skeleton-bar" />
    </div>
  );
}

interface ModeErrorBoundaryProps {
  mode: DashboardModeId;
  onSwitchToDefault: () => void;
  children: ReactNode;
}
interface ModeErrorBoundaryState {
  error: Error | null;
}

class DashboardModeErrorBoundary extends Component<ModeErrorBoundaryProps, ModeErrorBoundaryState> {
  state: ModeErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ModeErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    // eslint-disable-next-line no-console
    console.error(`[quotaarc] Dashboard mode "${this.props.mode}" failed to render`, error);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    const name = DASHBOARD_REGISTRY[this.props.mode].name;
    return (
      <div className="dashboard-host__error" role="alert">
        <p>Unable to load {name}</p>
        {this.props.mode !== "analytics2d" && (
          <button type="button" onClick={this.props.onSwitchToDefault}>
            Switch to 2D Analytics
          </button>
        )}
      </div>
    );
  }
}

export default function DashboardHost({
  mode,
  state,
  onOpenProviders,
  onSwitchToDefault,
}: {
  mode: DashboardModeId | string | undefined;
  state: BootstrapState;
  onOpenProviders: () => void;
  onSwitchToDefault: () => void;
}) {
  const resolved = resolveDashboardMode(mode);
  const definition = DASHBOARD_REGISTRY[resolved];
  const Mode = definition.loader;

  return (
    <DashboardModeErrorBoundary key={resolved} mode={resolved} onSwitchToDefault={onSwitchToDefault}>
      <Suspense fallback={<DashboardHostSkeleton />}>
        <Mode state={state} onOpenProviders={onOpenProviders} onSwitchToAnalytics2D={onSwitchToDefault} />
      </Suspense>
    </DashboardModeErrorBoundary>
  );
}
