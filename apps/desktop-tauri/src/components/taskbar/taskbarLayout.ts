export type TaskbarStageState = "compact" | "expanded";

export interface TaskbarPoint {
  x: number;
  y: number;
}

export interface TaskbarNode extends TaskbarPoint {
  angle: number;
}

export interface TaskbarLayout {
  width: number;
  height: number;
  nodeSize: number;
  labelWidth: number;
  labelDepth: number;
  orbitRadius: number;
  core: TaskbarPoint & { radius: number };
  nodes: TaskbarNode[];
}

export const TASKBAR_STAGE_WIDTH = 820;
export const TASKBAR_COMPACT_HEIGHT = 360;
export const TASKBAR_EXPANDED_HEIGHT = 540;

function compactAngles(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const spread = 136;
  return Array.from(
    { length: count },
    (_, index) => -spread / 2 + (spread * index) / (count - 1),
  );
}

function expandedAngles(count: number): number[] {
  if (count <= 0) return [];
  return Array.from(
    { length: count },
    (_, index) => -90 + (360 * index) / count,
  );
}

/**
 * Authoritative taskbar geometry shared by the native surface and visual
 * harness. Coordinates are native logical pixels and never depend on DOM
 * measurement, keeping screenshots and the Tauri window in lockstep.
 */
export function taskbarLayout(
  state: TaskbarStageState,
  providerCount: number,
): TaskbarLayout {
  const count = Math.max(0, Math.min(7, Math.trunc(providerCount)));
  const expanded = state === "expanded";
  const width = TASKBAR_STAGE_WIDTH;
  const height = expanded ? TASKBAR_EXPANDED_HEIGHT : TASKBAR_COMPACT_HEIGHT;
  const core = expanded
    ? { x: width / 2, y: 270, radius: 92 }
    : { x: width / 2, y: 342, radius: 72 };
  const orbitRadius = expanded ? 200 : 310;
  const nodeSize = expanded ? 66 : 58;
  const labelWidth = 96;
  const labelDepth = expanded ? 32 : 28;
  const angles = expanded ? expandedAngles(count) : compactAngles(count);

  return {
    width,
    height,
    nodeSize,
    labelWidth,
    labelDepth,
    orbitRadius,
    core,
    nodes: angles.map((angle) => {
      const radians = (angle * Math.PI) / 180;
      return {
        angle,
        x: core.x + (expanded ? 288 : orbitRadius) * Math.sin(radians),
        y: core.y - orbitRadius * Math.cos(radians),
      };
    }),
  };
}
