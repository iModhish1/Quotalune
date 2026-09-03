export type TopOrbitState = "compact" | "expanded";

export interface TopOrbitPoint {
  x: number;
  y: number;
}

export interface TopOrbitLayout {
  width: number;
  height: number;
  nodeSize: number;
  nodeFootprint: number;
  labelDepth: number;
  nodes: TopOrbitPoint[];
  summary: TopOrbitPoint & { radius: number };
}

export const TOP_ORBIT_COMPACT_WIDTH = 680;
export const TOP_ORBIT_COMPACT_HEIGHT = 180;
export const TOP_ORBIT_EXPANDED_WIDTH = 760;
export const TOP_ORBIT_EXPANDED_HEIGHT = 430;

export function topOrbitLayout(
  state: TopOrbitState,
  providerCount: number,
): TopOrbitLayout {
  const expanded = state === "expanded";
  const width = expanded ? TOP_ORBIT_EXPANDED_WIDTH : TOP_ORBIT_COMPACT_WIDTH;
  const height = expanded ? TOP_ORBIT_EXPANDED_HEIGHT : TOP_ORBIT_COMPACT_HEIGHT;
  const count = Math.max(0, Math.min(7, Math.trunc(providerCount)));
  const margin = expanded ? 86 : 74;
  const centerY = expanded ? 92 : 82;
  const bow = expanded ? 58 : 44;
  const nodes = Array.from({ length: count }, (_, index) => {
    const unit = count <= 1 ? 0 : (index / (count - 1)) * 2 - 1;
    return {
      x: margin + ((width - margin * 2) * (unit + 1)) / 2,
      y: centerY + bow * (1 - Math.pow(Math.abs(unit), 1.55)),
    };
  });

  return {
    width,
    height,
    nodeSize: expanded ? 54 : 44,
    nodeFootprint: expanded ? 92 : 82,
    labelDepth: expanded ? 30 : 22,
    nodes,
    summary: expanded
      ? { x: width / 2, y: 300, radius: 82 }
      : { x: width / 2, y: 18, radius: 28 },
  };
}
