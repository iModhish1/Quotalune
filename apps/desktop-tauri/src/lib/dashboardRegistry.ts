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
const SpatialDashboard = lazy(() => import("../surfaces/dashboard/SpatialDashboard"));

export const DASHBOARD_REGISTRY: Record<DashboardModeId, DashboardDefinition> = {
  analytics2d: {
    id: "analytics2d",
    name: "Analytics",
    shortDescription: "Clear analytics and historical insight.",
    longDescription:
      "Precision analytics: usage trends, spend, resets, and provider comparisons. Lowest rendering overhead.",
    performanceClass: "lowest",
    supports3d: false,
    isPlaceholder: false,
    loader: AnalyticsDashboard,
  },
  // Phase S1: the lightweight DOM/SVG/CSS prototype -- zero WebGL
  // contexts, no Three.js import (owner section 47). Kept as its own
  // wire value (`spatial`) distinct from `providers3d` so a user who
  // picks either keeps their choice across a future rename of either
  // mode's *label* (owner section 35).
  spatial: {
    id: "spatial",
    name: "Spatial",
    shortDescription: "Lightweight dimensional provider overview.",
    longDescription:
      "A dimensional provider overview built from DOM, SVG, and CSS -- no WebGL, no 3D engine. Prototype for owner comparison against Experimental 3D.",
    performanceClass: "medium",
    supports3d: false,
    isPlaceholder: true,
    loader: SpatialDashboard,
  },
  // Publicly labeled "Experimental 3D" (owner section 36) -- the wire
  // value (`providers3d`) is unchanged so existing persisted settings
  // keep working; only the user-facing name/description changed.
  providers3d: {
    id: "providers3d",
    name: "Experimental 3D",
    shortDescription: "Full WebGL provider visualization.",
    longDescription:
      "Full WebGL provider visualization -- usage, state, and focus in an interactive 3D scene. Higher GPU/resource use. Experimental.",
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

/** Ordered for consistent rendering in the Dashboard Studio mode-select
 *  UI. Phase S1 owner section 35: the public picker shows exactly
 *  Analytics / Spatial / Experimental 3D -- `hybrid` stays a real,
 *  preserved `DASHBOARD_REGISTRY` entry (its wire value keeps working
 *  for anyone who somehow has it persisted) but is deliberately left out
 *  of this visible list, since it has never been more than an
 *  unimplemented placeholder and isn't part of the current product
 *  architecture (owner section 1). */
export const DASHBOARD_DEFINITIONS: DashboardDefinition[] = [
  DASHBOARD_REGISTRY.analytics2d,
  DASHBOARD_REGISTRY.spatial,
  DASHBOARD_REGISTRY.providers3d,
];

export function isDashboardModeId(value: string): value is DashboardModeId {
  return value === "analytics2d" || value === "providers3d" || value === "hybrid" || value === "spatial";
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
