/**
 * Typed bridge for QuotaArc Surface Engine commands.
 */
import { invoke } from "@tauri-apps/api/core";

export interface SurfaceSettingsPatch {
  edgeArcEnabled?: boolean;
  edgeArcSide?: "left" | "right";
  edgeArcOpacity?: number;
  edgeArcScale?: number;
  edgeArcClickThrough?: boolean;
  edgeArcHideFullscreen?: boolean;
  topArcEnabled?: boolean;
  topArcOpacity?: number;
  topArcScale?: number;
  topArcClickThrough?: boolean;
  topArcHideFullscreen?: boolean;
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

export function resizeEdgeArc(width: number, height: number): Promise<void> {
  return invoke("resize_edge_arc_surface", { width, height });
}

export function resizeTopArc(width: number, height: number): Promise<void> {
  return invoke("resize_top_arc_surface", { width, height });
}

export function updateSurfaceSettings(patch: SurfaceSettingsPatch): Promise<void> {
  return invoke("update_surface_settings", { patch });
}

export interface SurfaceSettings {
  edgeArcEnabled: boolean;
  edgeArcSide: "left" | "right";
  edgeArcOpacity: number;
  edgeArcScale: number;
  edgeArcClickThrough: boolean;
  edgeArcHideFullscreen: boolean;
  topArcEnabled: boolean;
  topArcOpacity: number;
  topArcScale: number;
  topArcClickThrough: boolean;
  topArcHideFullscreen: boolean;
}

export function getSurfaceSettings(): Promise<SurfaceSettings> {
  return invoke("get_surface_settings");
}
