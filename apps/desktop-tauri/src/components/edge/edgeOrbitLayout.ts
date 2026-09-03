export type EdgeOrbitState = "compact" | "expanded";

export interface EdgeOrbitPoint {
  x: number;
  y: number;
}

export interface EdgeOrbitLayout {
  width: number;
  height: number;
  nodeSize: number;
  labelDepth: number;
  detailWidth: number;
  nodes: EdgeOrbitPoint[];
  core: EdgeOrbitPoint & { radius: number };
}

export const EDGE_ORBIT_COMPACT_WIDTH = 180;
export const EDGE_ORBIT_COMPACT_HEIGHT = 560;
export const EDGE_ORBIT_EXPANDED_WIDTH = 420;
export const EDGE_ORBIT_EXPANDED_HEIGHT = 600;

export function edgeOrbitLayout(
  state: EdgeOrbitState,
  providerCount: number,
): EdgeOrbitLayout {
  const expanded = state === "expanded";
  const width = expanded ? EDGE_ORBIT_EXPANDED_WIDTH : EDGE_ORBIT_COMPACT_WIDTH;
  const height = expanded ? EDGE_ORBIT_EXPANDED_HEIGHT : EDGE_ORBIT_COMPACT_HEIGHT;
  const count = Math.max(0, Math.min(7, Math.trunc(providerCount)));
  const nodes = Array.from({ length: count }, (_, index) => {
    const unit = count <= 1 ? 0 : (index / (count - 1)) * 2 - 1;
    return {
      x: expanded
        ? 270 - 130 * Math.sqrt(Math.max(0, 1 - unit * unit))
        : 132 - 16 * (1 - Math.abs(unit)),
      y: expanded
        ? 72 + ((height - 144) * (unit + 1)) / 2
        : 56 + ((height - 112) * (unit + 1)) / 2,
    };
  });

  return {
    width,
    height,
    nodeSize: expanded ? 52 : 44,
    labelDepth: expanded ? 0 : 18,
    detailWidth: expanded ? 114 : 0,
    nodes,
    core: expanded
      ? { x: 404, y: height / 2, radius: 82 }
      : { x: 168, y: height / 2, radius: 44 },
  };
}
