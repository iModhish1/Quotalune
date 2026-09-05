import type { FlowSurfaceState } from "../../design-system/flowSurface";

export function reelOffset(index: number, focus: number, count: number): number {
  if (count < 2) return 0;
  const delta = ((index - focus) % count + count) % count;
  return delta > count / 2 ? delta - count : delta;
}

export function reelPoint(offset: number, horizontal: boolean) {
  const distance = Math.min(2, Math.abs(offset));
  const x = 44 + distance * 30;
  const y = 104 + Math.sign(offset) * distance * 66;
  return horizontal ? { x: y, y: x } : { x, y };
}

export function reelBaseSize(state: FlowSurfaceState, horizontal: boolean) {
  if (state === "hidden" || state === "peek") return horizontal
    ? { width: 58, height: 28 } : { width: 28, height: 58 };
  if (state === "expanded" || state === "pinned") return horizontal
    ? { width: 288, height: 280 } : { width: 320, height: 224 };
  return horizontal ? { width: 208, height: 112 } : { width: 112, height: 208 };
}

export interface WheelState { sum: number; lastAt: number }
export function wheelStep(state: WheelState, delta: number, now: number): { step: -1 | 0 | 1; state: WheelState } {
  if (!Number.isFinite(delta) || now - state.lastAt < 160) return { step: 0, state };
  const sum = Math.sign(delta) !== Math.sign(state.sum) ? delta : state.sum + delta;
  if (Math.abs(sum) < 24) return { step: 0, state: { ...state, sum } };
  return { step: sum > 0 ? 1 : -1, state: { sum: 0, lastAt: now } };
}
