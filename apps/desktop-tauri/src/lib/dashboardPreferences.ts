import type { DashboardPerformancePreset } from "../types/bridge";

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
