import { describe, expect, it, vi } from "vitest";
import { computeDevicePixelRatio, DirtyRenderScheduler, cameraTransitionDurationMs } from "./renderPolicy";

describe("computeDevicePixelRatio", () => {
  it("passes through a raw DPR under the cap", () => {
    expect(computeDevicePixelRatio(1.0, "highFidelity")).toBe(1.0);
  });

  it.each([
    ["lowCpu", 1.0],
    ["balanced", 1.5],
    ["highFidelity", 2.0],
  ] as const)("caps a 4K/HiDPI devicePixelRatio (e.g. 3.0) at the %s preset's bound", (preset, cap) => {
    expect(computeDevicePixelRatio(3.0, preset)).toBe(cap);
  });

  it("falls back to 1 for a non-finite or non-positive raw DPR", () => {
    expect(computeDevicePixelRatio(Number.NaN, "balanced")).toBe(1);
    expect(computeDevicePixelRatio(0, "balanced")).toBe(1);
    expect(computeDevicePixelRatio(-2, "balanced")).toBe(1);
  });
});

describe("DirtyRenderScheduler", () => {
  it("renders nothing until requestRender is called -- no permanent loop", () => {
    const render = vi.fn();
    const requestFrame = vi.fn();
    const cancelFrame = vi.fn();
    new DirtyRenderScheduler(requestFrame, cancelFrame, render);
    expect(requestFrame).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
  });

  it("schedules exactly one frame and renders exactly once per requestRender burst", () => {
    let pendingCallback: (() => void) | null = null;
    const requestFrame = vi.fn((cb: () => void) => {
      pendingCallback = cb;
      return 1;
    });
    const cancelFrame = vi.fn();
    const render = vi.fn();
    const scheduler = new DirtyRenderScheduler(requestFrame, cancelFrame, render);

    // Many calls before the frame actually fires -- must coalesce to one.
    scheduler.requestRender();
    scheduler.requestRender();
    scheduler.requestRender();
    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(scheduler.isScheduled()).toBe(true);

    pendingCallback!();
    expect(render).toHaveBeenCalledTimes(1);
    expect(scheduler.renderCount).toBe(1);
    // Proves the engine does NOT free-run: after the one scheduled frame
    // fires, nothing is scheduled again until requestRender is called.
    expect(scheduler.isScheduled()).toBe(false);
  });

  it("idle scene: zero requestRender calls means zero renders (the core anti-60fps-idle-loop proof)", () => {
    const render = vi.fn();
    const requestFrame = vi.fn();
    const cancelFrame = vi.fn();
    const scheduler = new DirtyRenderScheduler(requestFrame, cancelFrame, render);
    // Simulate "idle, settled scene, no interaction" -- nothing calls
    // requestRender at all.
    expect(scheduler.renderCount).toBe(0);
    expect(render).not.toHaveBeenCalled();
  });

  it("schedules a new frame again after a prior one has fired (data update after idle)", () => {
    const callbacks: Array<() => void> = [];
    const requestFrame = vi.fn((cb: () => void) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    const render = vi.fn();
    const scheduler = new DirtyRenderScheduler(requestFrame, () => {}, render);

    scheduler.requestRender();
    callbacks[0]();
    expect(render).toHaveBeenCalledTimes(1);

    // A later, independent change (e.g. a data refresh) must schedule
    // and render again.
    scheduler.requestRender();
    expect(requestFrame).toHaveBeenCalledTimes(2);
    callbacks[1]();
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("dispose cancels a pending frame and prevents any further scheduling", () => {
    const cancelFrame = vi.fn();
    const requestFrame = vi.fn(() => 42);
    const render = vi.fn();
    const scheduler = new DirtyRenderScheduler(requestFrame, cancelFrame, render);

    scheduler.requestRender();
    scheduler.dispose();
    expect(cancelFrame).toHaveBeenCalledWith(42);

    scheduler.requestRender();
    expect(requestFrame).toHaveBeenCalledTimes(1); // no second schedule after dispose
    expect(render).not.toHaveBeenCalled();
  });
});

describe("cameraTransitionDurationMs", () => {
  it("is short but nonzero with motion enabled", () => {
    const ms = cameraTransitionDurationMs(false);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThan(1000);
  });

  it("collapses to zero (instant) under reduced motion", () => {
    expect(cameraTransitionDurationMs(true)).toBe(0);
  });
});
