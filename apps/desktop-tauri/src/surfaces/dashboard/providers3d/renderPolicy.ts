/**
 * Phase 5: pure, WebGL-free render-scheduling policy.
 *
 * Kept separate from `engine.ts` specifically so the dirty-render
 * scheduler and the DPR cap policy are unit-testable without a real
 * WebGL context (owner Phase 5 section 66: "if WebGL unit testing is
 * impractical, test pure logic separately... do not spend days forcing
 * jsdom to emulate WebGL").
 */
import type { DashboardPerformancePreset } from "../../../types/bridge";

/** Bounded device-pixel-ratio cap per performance preset (owner section
 *  10) -- never blindly render at the raw `window.devicePixelRatio` on a
 *  4K/HiDPI display. */
const DPR_CAP: Record<DashboardPerformancePreset, number> = {
  lowCpu: 1.0,
  balanced: 1.5,
  highFidelity: 2.0,
};

export function computeDevicePixelRatio(
  rawDevicePixelRatio: number,
  preset: DashboardPerformancePreset,
): number {
  const cap = DPR_CAP[preset];
  const safe = Number.isFinite(rawDevicePixelRatio) && rawDevicePixelRatio > 0 ? rawDevicePixelRatio : 1;
  return Math.min(safe, cap);
}

/**
 * Event-driven "dirty" render scheduler (owner section 7/8): render
 * ONLY when something actually changed (camera interaction, hover,
 * selection, data update, theme change, resize, a short transition),
 * then stop. Never a permanent `requestAnimationFrame` loop running at
 * a fixed frame rate while the scene is static.
 *
 * The scheduler itself has no Three.js/DOM dependency -- `requestFrame`/
 * `cancelFrame`/`render` are injected, so this class is fully testable
 * with fake timers and a spy render function.
 */
export class DirtyRenderScheduler {
  private scheduled = false;
  private disposed = false;
  /** Number of frames actually rendered -- exposed for lifecycle/idle
   *  instrumentation tests and for the Phase 5 DEV lab's idle-frame-count
   *  proof (owner section 8: "prove idle frame count stops or becomes
   *  negligible"). */
  renderCount = 0;

  constructor(
    private readonly requestFrame: (cb: () => void) => number,
    private readonly cancelFrame: (handle: number) => void,
    private readonly render: () => void,
  ) {}

  private handle: number | null = null;

  /** Mark the scene dirty and ensure exactly one frame is scheduled --
   *  calling this many times before that frame runs schedules only one
   *  render, never one per call. */
  requestRender(): void {
    if (this.disposed || this.scheduled) return;
    this.scheduled = true;
    this.handle = this.requestFrame(() => {
      this.scheduled = false;
      this.handle = null;
      if (this.disposed) return;
      this.render();
      this.renderCount += 1;
    });
  }

  /** True only while a frame is pending -- once that frame runs, this
   *  returns to `false` and NOTHING renders again until `requestRender`
   *  is called explicitly. This is the property that proves the engine
   *  never free-runs at 60fps while idle. */
  isScheduled(): boolean {
    return this.scheduled;
  }

  dispose(): void {
    if (this.handle != null) this.cancelFrame(this.handle);
    this.disposed = true;
    this.scheduled = false;
  }
}

/** Short, interruptible camera-transition duration (owner section 22) --
 *  reduced-motion collapses this to an effectively-instant transition
 *  (owner section 29), never a long cinematic fly-through either way. */
export function cameraTransitionDurationMs(reducedMotion: boolean): number {
  return reducedMotion ? 0 : 320;
}
