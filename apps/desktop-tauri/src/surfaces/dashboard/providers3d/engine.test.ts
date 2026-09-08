import { describe, expect, it } from "vitest";
import { createProvidersUniverseEngine } from "./engine";

/**
 * jsdom (this project's test environment) does not implement WebGL --
 * `HTMLCanvasElement.getContext("webgl2")` returns `null`, exactly like a
 * real machine with no GPU/driver support for WebGL2. This is not a
 * limitation to work around; it is a real, valid exercise of the exact
 * fallback path owner Phase 5 sections 41/42/70 require (see
 * PHASE5_3D_PROTOTYPE.md for the corresponding real-WebView2 proof this
 * unit test cannot substitute for).
 */
describe("createProvidersUniverseEngine", () => {
  it("never throws and returns a typed failure when WebGL2 is unavailable (jsdom has no WebGL)", () => {
    const canvas = document.createElement("canvas");
    const result = createProvidersUniverseEngine(canvas, {
      performancePreset: "balanced",
      reducedMotion: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("context-unavailable");
    }
  });

  it("does not crash the calling module even when invoked repeatedly (mode-switch resilience)", () => {
    for (let i = 0; i < 5; i += 1) {
      const canvas = document.createElement("canvas");
      expect(() =>
        createProvidersUniverseEngine(canvas, { performancePreset: "lowCpu", reducedMotion: true }),
      ).not.toThrow();
    }
  });
});
