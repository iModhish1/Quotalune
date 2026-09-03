import type { GeometryVariant } from "./geometryVariants";

interface SurfacePoint {
  x: number;
  y: number;
}

export interface CharacterizedSurfaceNode extends SurfacePoint {
  scale: number;
}

export interface SurfaceSafeArea {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function signedNoise(index: number): number {
  return ((((index + 1) * 0.618033988749895) % 1) * 2) - 1;
}

/**
 * Applies a theme's structural character to an already surface-correct node
 * topology. This keeps Taskbar/Top/Edge/HUD semantics intact while ensuring
 * petals, constellations, lenses, shutters and dunes are not mere recolors.
 */
export function characterizeSurfaceNodes<T extends SurfacePoint>(
  nodes: T[],
  center: SurfacePoint,
  geometry: GeometryVariant,
  safeArea?: SurfaceSafeArea,
): Array<T & CharacterizedSurfaceNode> {
  const count = nodes.length;
  return nodes.map((node, index) => {
    const dx = node.x - center.x;
    const dy = node.y - center.y;
    const radius = Math.hypot(dx, dy);
    const phase = count <= 1 ? 0 : index / (count - 1);
    const alternating = index % 2 === 0 ? 1 : -1;
    const noise = signedNoise(index);
    let angle = Math.atan2(dy, dx);
    let radialScale = 1;
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;

    switch (geometry) {
      case "petals":
        radialScale = 1 + alternating * 0.065;
        angle += alternating * 0.045;
        scale = alternating > 0 ? 1.06 : 0.94;
        break;
      case "dial":
        angle += (phase - 0.5) * 0.018;
        scale = 0.98;
        break;
      case "constellation":
        radialScale = 0.94 + (noise + 1) * 0.055;
        angle += noise * 0.075;
        scale = 0.94 + Math.abs(noise) * 0.04;
        break;
      case "spine":
        radialScale = 1 + alternating * 0.035;
        angle += alternating * 0.028;
        offsetY = alternating * Math.min(7, radius * 0.03);
        break;
      case "eclipse":
        radialScale = 0.96 + phase * 0.055;
        offsetX = Math.min(10, radius * 0.045);
        scale = index === Math.floor(count / 2) ? 1.07 : 0.97;
        break;
      case "facets":
        radialScale = alternating > 0 ? 1.055 : 0.93;
        angle += alternating * 0.02;
        scale = alternating > 0 ? 1.03 : 0.96;
        break;
      case "orchid":
        radialScale = 0.9 + phase * 0.105;
        angle += (phase - 0.5) * 0.13;
        scale = 0.94 + phase * 0.1;
        break;
      case "ice":
        radialScale = 0.96 + Math.abs(noise) * 0.075;
        offsetY = alternating * 5;
        scale = 0.95 + Math.abs(noise) * 0.05;
        break;
      case "lens":
        radialScale = 0.98;
        offsetX = -dx * 0.035;
        offsetY = -dy * 0.17;
        scale = 0.98 + (1 - Math.abs(phase - 0.5) * 2) * 0.07;
        break;
      case "nova":
        radialScale = alternating > 0 ? 1.055 : 0.965;
        scale = alternating > 0 ? 1.06 : 0.95;
        break;
      case "aperture":
        angle += 0.055;
        radialScale = 0.985 + alternating * 0.025;
        scale = 0.97;
        break;
      case "astrolabe":
        radialScale = alternating > 0 ? 1 : 0.92;
        angle += (phase - 0.5) * 0.035;
        scale = alternating > 0 ? 1.02 : 0.95;
        break;
      case "dunes":
        radialScale = 0.985 + Math.sin(index * 1.7) * 0.045;
        offsetY = Math.sin(index * 1.35) * Math.min(9, radius * 0.04);
        scale = 0.97 + (Math.sin(index * 1.7) + 1) * 0.025;
        break;
      case "orbit":
        break;
    }

    let x = center.x + Math.cos(angle) * radius * radialScale + offsetX;
    let y = center.y + Math.sin(angle) * radius * radialScale + offsetY;
    if (safeArea) {
      x = clamp(x, safeArea.left, safeArea.right);
      y = clamp(y, safeArea.top, safeArea.bottom);
    }

    return {
      ...node,
      x,
      y,
      scale: clamp(scale, 0.92, 1.08),
    };
  });
}
