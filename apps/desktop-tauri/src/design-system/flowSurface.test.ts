import { describe, expect, it } from "vitest";

import {
  DEFAULT_FLOW_SURFACE_SETTINGS,
  FLOW_SURFACE_FORM_CATALOG,
  flowSurfaceAnchorOptions,
  flowSurfaceDefaultAnchor,
  flowSurfaceEnvelope,
  hasSurfaceQuotaValue,
  normalizeFlowSurfaceSettings,
  resolveDetailDirection,
} from "./flowSurface";

describe("Flow Surface contract", () => {
  it("only treats finite resolved quota values as compact surface content", () => {
    expect(hasSurfaceQuotaValue({ arcFraction: 0.73, primaryValue: 73 })).toBe(true);
    expect(hasSurfaceQuotaValue({ arcFraction: null, primaryValue: null })).toBe(false);
    expect(hasSurfaceQuotaValue({ arcFraction: Number.NaN, primaryValue: 73 })).toBe(false);
  });

  it("uses the compact Flowline defaults when settings are missing or corrupt", () => {
    expect(normalizeFlowSurfaceSettings(undefined)).toEqual(DEFAULT_FLOW_SURFACE_SETTINGS);
    expect(normalizeFlowSurfaceSettings({
      form: "clockwork",
      anchor: "middle-right",
      scale: 9,
      autoHideDelayMs: 90,
    })).toEqual(DEFAULT_FLOW_SURFACE_SETTINGS);
  });

  it("clamps valid user scale and auto-hide timing without accepting invalid modes", () => {
    expect(normalizeFlowSurfaceSettings({
      form: "horizon",
      anchor: "bottom",
      scale: 200,
      autoHideDelayMs: 9_000,
    })).toEqual({
      form: "horizon",
      anchor: "bottom",
      scale: 125,
      autoHide: true,
      autoHideDelayMs: 3_000,
      interactions:{hoverDetails:true,wheelCycle:true,autoFold:true,foldDelayMs:500},
    });
  });

  it("keeps every compact form small enough to preserve a 1366px work area", () => {
    const flowline = flowSurfaceEnvelope("flowline", "compact", 100);
    expect(flowline.width).toBeLessThanOrEqual(1366 * 0.08);
    expect(flowline.height).toBeLessThanOrEqual(768 * 0.42);

    const horizon = flowSurfaceEnvelope("horizon", "compact", 100);
    expect(horizon.width).toBeLessThanOrEqual(1366 * 0.3);
    expect(horizon.height).toBeLessThanOrEqual(768 * 0.1);

    const petal = flowSurfaceEnvelope("petal", "compact", 100);
    expect(petal.width).toBeLessThanOrEqual(1366 * 0.16);
    expect(petal.height).toBeLessThanOrEqual(768 * 0.2);
  });

  it("directs details into available workspace rather than through an edge", () => {
    expect(resolveDetailDirection("flowline", "right")).toBe("left");
    expect(resolveDetailDirection("flowline", "left")).toBe("right");
    expect(resolveDetailDirection("horizon", "top")).toBe("down");
    expect(resolveDetailDirection("horizon", "bottom")).toBe("up");
    expect(resolveDetailDirection("petal", "bottom-left")).toBe("up-right");
  });

  it("reserves an interactive reveal tab even in hidden state", () => {
    expect(flowSurfaceEnvelope("flowline", "hidden", 100)).toEqual({
      width: 28,
      height: 58,
    });
    expect(flowSurfaceEnvelope("orbital", "hidden", 100)).toEqual({ width: 28, height: 28 });
    expect(flowSurfaceEnvelope("flowline","hidden",100,3,"top")).toEqual({width:58,height:28});
    expect(flowSurfaceEnvelope("horizon","hidden",100,3,"left")).toEqual({width:14,height:96});
  });

  it("shrinks a compact form when no provider has a truthful quota reading", () => {
    expect(flowSurfaceEnvelope("flowline", "compact", 100, 0)).toEqual({
      width: 56,
      height: 84,
    });
    expect(flowSurfaceEnvelope("flowline", "compact", 100, 3).height).toBeLessThan(310);
    expect(flowSurfaceEnvelope("flowline","compact",100,3,"top")).toEqual({width:226,height:56});
    expect(flowSurfaceEnvelope("horizon","compact",100,3,"left")).toEqual({width:58,height:350});
  });

  it("gives the expanded Flowline (left/right anchor) enough height for 3 stacked satellite gauges (Wave 6 Phase 4 clipping fix)", () => {
    // .flow-surface__quick-providers stacks vertically for left/right
    // anchors (unrotated) — live measurement on real content found a
    // ~42px top offset plus ~157px of gauges/gaps, so anything under
    // ~200px clips the third satellite's percentage against the window's
    // bottom edge (confirmed and root-caused live: height 160 clipped the
    // third gauge by ~40px, reported by the owner as a provider's percent
    // — "Gemini" in their screenshot — not showing clearly). 200 is the
    // measured floor; this pins a safe minimum rather than the exact
    // current value, so a deliberate future resize still passes as long
    // as it doesn't regress back into clipping territory.
    const envelope = flowSurfaceEnvelope("flowline", "expanded", 100, 3, "right");
    expect(envelope.height).toBeGreaterThanOrEqual(200);
  });

  it("keeps the orbital structure bounded and opens inward from its corner", () => {
    expect(flowSurfaceEnvelope("orbital", "compact", 100, 3)).toEqual({ width: 104, height: 104 });
    expect(flowSurfaceEnvelope("orbital", "compact", 100, 0)).toEqual({ width: 64, height: 64 });
    expect(resolveDetailDirection("orbital", "bottom-right")).toBe("up-left");
  });

  it("keeps the Lens structure compact and directs its detail card inward", () => {
    expect(flowSurfaceEnvelope("lens", "compact", 100, 3)).toEqual({ width: 178, height: 76 });
    expect(flowSurfaceEnvelope("lens", "compact", 100, 0)).toEqual({ width: 76, height: 56 });
    expect(resolveDetailDirection("lens", "right")).toBe("left");
  });

  it("defines each structure's label, default anchor, and safe anchors in one catalog", () => {
    expect(FLOW_SURFACE_FORM_CATALOG.map((form) => form.id)).toEqual([
      "crescent", "pebble", "fan", "seam", "ribbon", "cradle", "deck", "satellite", "flowline", "reel", "horizon", "petal", "orbital", "lens",
    ]);
    expect(flowSurfaceDefaultAnchor("lens")).toBe("bottom-right");
    expect(flowSurfaceAnchorOptions("flowline")).toEqual(["right","left","top","bottom","top-left","top-right","bottom-left","bottom-right","free"]);
    expect(flowSurfaceAnchorOptions("horizon")).toEqual(["right","left","top","bottom","top-left","top-right","bottom-left","bottom-right","free"]);
    expect(resolveDetailDirection("flowline","top-left")).toBe("right");
    expect(resolveDetailDirection("horizon","bottom-right")).toBe("left");
  });
});
