import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONNECTOR_THRESHOLDS,
  resolveStructureConnector,
} from "./structureConnector";

describe("resolveStructureConnector", () => {
  it("reads as attached (no connector) when the gap is at or below the threshold", () => {
    const touching = resolveStructureConnector({ x: 0, y: 0 });
    expect(touching.attached).toBe(true);
    expect(touching.connectorRequired).toBe(false);
    expect(touching.length).toBe(0);

    const atThreshold = resolveStructureConnector({ x: DEFAULT_CONNECTOR_THRESHOLDS.attachedThreshold, y: 0 });
    expect(atThreshold.attached).toBe(true);
  });

  it("requires a connector once the gap exceeds the attached threshold", () => {
    const result = resolveStructureConnector({ x: DEFAULT_CONNECTOR_THRESHOLDS.attachedThreshold + 1, y: 0 });
    expect(result.attached).toBe(false);
    expect(result.connectorRequired).toBe(true);
    expect(result.exceedsMaximum).toBe(false);
    expect(result.length).toBeGreaterThan(0);
  });

  it("flags exceedsMaximum instead of drawing an oversized connector once the gap is too large (§8: shift closer, don't draw a giant bridge)", () => {
    const result = resolveStructureConnector({ x: DEFAULT_CONNECTOR_THRESHOLDS.maxConnectorLength + 50, y: 0 });
    expect(result.exceedsMaximum).toBe(true);
    expect(result.connectorRequired).toBe(false);
    // length is still clamped, in case a caller ignores exceedsMaximum and
    // renders anyway -- it must never exceed the visual maximum.
    expect(result.length).toBeLessThanOrEqual(DEFAULT_CONNECTOR_THRESHOLDS.maxConnectorLength);
  });

  it("picks the dominant orientation from the larger axis, and 'diagonal' when neither dominates", () => {
    expect(resolveStructureConnector({ x: 20, y: 2 }).orientation).toBe("horizontal");
    expect(resolveStructureConnector({ x: 2, y: 20 }).orientation).toBe("vertical");
    expect(resolveStructureConnector({ x: 15, y: 12 }).orientation).toBe("diagonal");
  });

  it("supports custom thresholds without mutating the shared default", () => {
    const tight = resolveStructureConnector({ x: 10, y: 0 }, { attachedThreshold: 20, maxConnectorLength: 40 });
    expect(tight.attached).toBe(true);
    expect(DEFAULT_CONNECTOR_THRESHOLDS.attachedThreshold).toBe(6);
  });

  it("uses the same attached-gap number structurePlacement.ts's DEFAULT_GAP does, so the two modules never disagree", () => {
    // Documented in the module's own comment; pinned here so a future
    // change to either constant surfaces as a failing test, not a silent
    // divergence between "is this attached" and "what gap did we place at".
    expect(DEFAULT_CONNECTOR_THRESHOLDS.attachedThreshold).toBe(6);
  });
});
