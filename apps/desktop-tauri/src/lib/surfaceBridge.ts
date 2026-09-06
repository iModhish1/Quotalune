/**
 * Typed bridge for QuotaArc Surface Engine commands.
 */
import { invoke } from "@tauri-apps/api/core";

export interface SurfaceSettingsPatch {
  interactions?: import("../design-system/surfaceInteractions").SurfaceInteractions;
  edgeArcEnabled?: boolean;
  edgeArcSide?: "left" | "right";
  edgeArcOpacity?: number;
  edgeArcScale?: number;
  edgeArcClickThrough?: boolean;
  edgeArcHideFullscreen?: boolean;
  topArcEnabled?: boolean;
  topArcOpacity?: number;
  topArcScale?: number;
  topArcPlacement?: "top-left" | "top-center" | "top-right" | "free";
  topArcForm?: import("../design-system/flowSurface").FlowSurfaceForm;
  topArcAnchor?: "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "free";
  topArcAutoHide?: boolean;
  topArcAutoHideDelayMs?: number;
  topArcClickThrough?: boolean;
  topArcHideFullscreen?: boolean;
  taskbarArcEnabled?: boolean;
  taskbarArcOpacity?: number;
  taskbarArcClickThrough?: boolean;
  taskbarArcHideFullscreen?: boolean;
}

export function showEdgeArc(): Promise<void> {
  return invoke("show_edge_arc_surface");
}

export function hideEdgeArc(): Promise<void> {
  return invoke("hide_edge_arc_surface");
}

export function showTopArc(): Promise<void> {
  return invoke("show_top_arc_surface");
}

export function hideTopArc(): Promise<void> {
  return invoke("hide_top_arc_surface");
}

export type SurfaceWindowState = "hidden" | "peek" | "compact" | "hover" | "expanded";

export function resizeEdgeArc(state: SurfaceWindowState, providerCount: number): Promise<void> {
  return invoke("resize_edge_arc_surface", { state, providerCount });
}

export function resizeTopArc(state: SurfaceWindowState, providerCount: number): Promise<void> {
  return invoke("resize_top_arc_surface", { state, providerCount });
}

/** Persist the intent to freely place the island before native dragging starts. */
export function beginQuotaIslandDrag(): Promise<void> {
  return invoke("begin_top_arc_drag");
}

/** Return the island to a predictable visible top-center position. */
export function resetQuotaIslandPosition(): Promise<void> {
  return invoke("reset_top_arc_position");
}

export function showTaskbarArc(): Promise<void> {
  return invoke("show_taskbar_arc_surface");
}

export function hideTaskbarArc(): Promise<void> {
  return invoke("hide_taskbar_arc_surface");
}

export function resizeTaskbarArc(
  state: SurfaceWindowState,
  providerCount: number,
): Promise<void> {
  return invoke("resize_taskbar_arc_surface", { state, providerCount });
}

export function updateSurfaceSettings(patch: SurfaceSettingsPatch): Promise<void> {
  return invoke("update_surface_settings", { patch });
}

export interface SurfaceSettings {
  interactions?: import("../design-system/surfaceInteractions").SurfaceInteractions;
  edgeArcEnabled: boolean;
  edgeArcSide: "left" | "right";
  edgeArcOpacity: number;
  edgeArcScale: number;
  edgeArcClickThrough: boolean;
  edgeArcHideFullscreen: boolean;
  topArcEnabled: boolean;
  topArcOpacity: number;
  topArcScale: number;
  topArcPlacement: "top-left" | "top-center" | "top-right" | "free";
  topArcForm: import("../design-system/flowSurface").FlowSurfaceForm;
  topArcAnchor: "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "free";
  topArcAutoHide: boolean;
  topArcAutoHideDelayMs: number;
  topArcClickThrough: boolean;
  topArcHideFullscreen: boolean;
  taskbarArcEnabled: boolean;
  taskbarArcOpacity: number;
  taskbarArcClickThrough: boolean;
  taskbarArcHideFullscreen: boolean;
}

export function getSurfaceSettings(): Promise<SurfaceSettings> {
  return invoke("get_surface_settings");
}
