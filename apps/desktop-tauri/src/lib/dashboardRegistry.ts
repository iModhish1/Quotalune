import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { DashboardModeId, DashboardPerformancePreset } from "../types/bridge";

/**
 * The typed Dashboard mode registry -- the ONE authoritative place that
 * knows what Dashboard experiences exist, so no `if (mode === ...)` chain
 * is scattered across Settings/Dashboard surfaces. Adding a fourth mode
 * later means adding one entry here, not touching every consumer.
 *
 * Each `loader` is a React.lazy dynamic import -- the module for a
 * non-selected mode is never requested, let alone mounted (see
 * `DashboardHost.tsx`, the one place that actually renders `loader`).
 */
export interface DashboardDefinition {
  id: DashboardModeId;
  name: string;
  shortDescription: string;
  longDescription: string;
  /** Coarse rendering-cost signal for the mode itself (independent of the
   *  user's chosen `DashboardPerformancePreset`, which tunes *within* a
   *  mode). */
  performanceClass: "lowest" | "medium" | "high";
  supports3d: boolean;
  /** True for a mode whose implementation is a Dev-only placeholder this
   *  phase (Phase 2) -- not yet a real Dashboard experience. Never shown
   *  as complete to a Personal/production user. */
  isPlaceholder: boolean;
  loader: LazyExoticComponent<ComponentType<DashboardModeProps>>;
}

/** Every Dashboard mode component receives this same shape, whether it's
 *  the real 2D baseline or a Phase 2 placeholder -- so `DashboardHost`
 *  never needs mode-specific prop wiring. */
export interface DashboardModeProps {
  state: import("../types/bridge").BootstrapState;
  onOpenProviders: () => void;
  /** Switches the Dashboard mode itself back to the 2D baseline
   *  (`analytics2d`) -- distinct from `onOpenProviders`, which opens the
   *  Providers settings tab. Threaded from `DashboardHost`'s own
   *  `onSwitchToDefault` (already used by its per-mode error boundary),
   *  so a mode's own in-body escape hatch (e.g. the 3D engine's WebGL-
   *  unavailable fallback) uses the exact same real switch, not a second
   *  mechanism that only looks like it does the same thing. */
  onSwitchToAnalytics2D: () => void;
}

const AnalyticsDashboard = lazy(() => import("../surfaces/dashboard/AnalyticsDashboard"));
const Providers3DDashboard = lazy(() => import("../surfaces/dashboard/Providers3DDashboard"));
const HybridDashboard = lazy(() => import("../surfaces/dashboard/HybridDashboard"));

export const DASHBOARD_REGISTRY: Record<DashboardModeId, DashboardDefinition> = {
  analytics2d: {
    id: "analytics2d",
    name: "2D Analytics Dashboard",
    shortDescription: "Clear analytics and historical insight.",
    longDescription:
      "Precision analytics: usage trends, spend, resets, and provider comparisons. Lowest rendering overhead.",
    performanceClass: "lowest",
    supports3d: false,
    isPlaceholder: false,
    loader: AnalyticsDashboard,
  },
  providers3d: {
    id: "providers3d",
    name: "3D Providers Dashboard",
    shortDescription: "Immersive provider visualization.",
    longDescription:
      "Spatial provider exploration -- usage, state, and focus in an interactive 3D scene. Higher visual workload.",
    performanceClass: "high",
    supports3d: true,
    isPlaceholder: true,
    loader: Providers3DDashboard,
  },
  hybrid: {
    id: "hybrid",
    name: "Hybrid Dashboard",
    shortDescription: "Analytics + spatial provider context.",
    longDescription: "A small spatial provider overview alongside selected analytics widgets.",
    performanceClass: "medium",
    supports3d: true,
    isPlaceholder: true,
    loader: HybridDashboard,
  },
};

/** Ordered for consistent rendering in the Dashboard Studio mode-select UI. */
export const DASHBOARD_DEFINITIONS: DashboardDefinition[] = [
  DASHBOARD_REGISTRY.analytics2d,
  DASHBOARD_REGISTRY.providers3d,
  DASHBOARD_REGISTRY.hybrid,
];

export function isDashboardModeId(value: string): value is DashboardModeId {
  return value === "analytics2d" || value === "providers3d" || value === "hybrid";
}

/** The one safe fallback when a persisted mode is missing/corrupt --
 *  lowest overhead, the only non-placeholder mode. */
export const DEFAULT_DASHBOARD_MODE: DashboardModeId = "analytics2d";

export function resolveDashboardMode(value: string | undefined | null): DashboardModeId {
  if (value && isDashboardModeId(value)) return value;
  return DEFAULT_DASHBOARD_MODE;
}

export const DASHBOARD_PERFORMANCE_PRESETS: {
  id: DashboardPerformancePreset;
  name: string;
  description: string;
}[] = [
  { id: "lowCpu", name: "Low CPU", description: "Maximum efficiency. Reduced animation and visual effects." },
  { id: "balanced", name: "Balanced", description: "Recommended. Strong visuals with controlled resource use." },
  { id: "highFidelity", name: "High Fidelity", description: "Maximum visual quality. Higher rendering cost." },
];

export function isDashboardPerformancePreset(value: string): value is DashboardPerformancePreset {
  return value === "lowCpu" || value === "balanced" || value === "highFidelity";
}

export const DEFAULT_DASHBOARD_PERFORMANCE_PRESET: DashboardPerformancePreset = "balanced";

export function resolveDashboardPerformancePreset(
  value: string | undefined | null,
): DashboardPerformancePreset {
  if (value && isDashboardPerformancePreset(value)) return value;
  return DEFAULT_DASHBOARD_PERFORMANCE_PRESET;
}
