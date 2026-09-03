/**
 * QuotaArc V5 — true radial layout engine.
 *
 * Providers are placed at computed polar coordinates — never flex rows.
 * Angles are in degrees, 0 = up (12 o'clock), increasing clockwise, so the
 * same math mirrors naturally for left/right anchors.
 */

export interface Polar {
  x: number;
  y: number;
  angleDeg: number;
}

export function polar(cx: number, cy: number, radius: number, angleDeg: number): Polar {
  const rad = ((angleDeg - 90) * Math.PI) / 180; // 0deg = up
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad), angleDeg };
}

export type OrbitMode =
  | "FULL_ORBIT"
  | "SEMICIRCLE_UP"
  | "SEMICIRCLE_DOWN"
  | "LEFT_HALF_ORBIT"
  | "RIGHT_HALF_ORBIT"
  | "QUARTER_ORBIT"
  | "FAN";

export interface OrbitSpec {
  centerX: number;
  centerY: number;
  radius: number;
  mode: OrbitMode;
  count: number;
}

/**
 * Stable angular slots (slot-center semantics): 0° = up, clockwise.
 * SEMICIRCLE_UP   → -60/0/+60 for 3 (spread across the top)
 * SEMICIRCLE_DOWN → 120/180/240 for 3 (spread across the bottom)
 * LEFT_HALF_ORBIT → 225/270/315 for 3 (visible left of a right-edge core)
 * RIGHT_HALF_ORBIT→ -45/0/45 for 3 (visible right of a left-edge core)
 */
export function computeOrbit(spec: OrbitSpec): Polar[] {
  const { centerX, centerY, radius, mode, count } = spec;
  if (count <= 0) return [];
  const out: Polar[] = [];
  for (let i = 0; i < count; i++) {
    let angle = 0;
    switch (mode) {
      case "FULL_ORBIT":
        angle = (360 / count) * i;
        break;
      case "SEMICIRCLE_UP":
        angle = -90 + ((i + 0.5) * 180) / count;
        break;
      case "SEMICIRCLE_DOWN":
        angle = 90 + ((i + 0.5) * 180) / count;
        break;
      case "LEFT_HALF_ORBIT":
        angle = 180 + ((i + 0.5) * 180) / count;
        break;
      case "RIGHT_HALF_ORBIT":
        angle = -90 + ((i + 0.5) * 180) / count;
        break;
      case "QUARTER_ORBIT":
        angle = ((i + 0.5) * 90) / count;
        break;
      case "FAN":
        angle = -60 + ((i + 0.5) * 120) / count;
        break;
    }
    out.push(polar(centerX, centerY, radius, angle));
  }
  return out;
}

/** Tonal material family (opaque — no transparency compromise). */
export const V5_MATERIAL = {
  core: "#0B0F14",
  coreEdge: "#131B25",
  deep: "#07090C",
  surface: "#0F151D",
  raised: "#131B25",
} as const;
