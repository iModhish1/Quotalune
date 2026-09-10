import { Component, Suspense, lazy, type ReactNode } from "react";
import type { BootstrapState } from "../../types/bridge";
import "./DashboardHost.css";

const AnalyticsDashboard = lazy(() => import("./AnalyticsDashboard"));
export interface DashboardProps { state: BootstrapState; onOpenProviders: (id?:string) => void; view?: "overview"|"analytics"; initialProvider?:string|null; onAnalytics?: (id?:string)=>void; }
class DashboardErrorBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() {
    if (this.state.failed) return <div role="alert" className="dashboard-host__error">Dashboard unavailable</div>;
    return this.props.children;
  }
}
export default function DashboardHost(props: DashboardProps) {
  return <DashboardErrorBoundary><Suspense fallback={<div role="status" className="dashboard-host__skeleton" aria-label="Loading Dashboard" />}><AnalyticsDashboard {...props} /></Suspense></DashboardErrorBoundary>;
}
