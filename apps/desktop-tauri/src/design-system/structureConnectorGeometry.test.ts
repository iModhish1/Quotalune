import { describe, expect, it } from "vitest";
import { structureConnectorReferenceGap } from "./structureConnectorGeometry";
import { resolveStructureConnector } from "./structureConnector";

describe("structureConnectorReferenceGap", () => {
  it("Notch forms share the same real 12px gap notchLayout() computes", () => {
    for (const form of ["crescent", "pebble", "fan", "seam", "ribbon", "cradle", "deck", "satellite"] as const) {
      expect(structureConnectorReferenceGap(form)).toEqual({ x: 12, y: 12 });
    }
  });

  it("petal/orbital/lens overlap by design and resolve to attached (no connector)", () => {
    for (const form of ["petal", "orbital", "lens"] as const) {
      const decision = resolveStructureConnector(structureConnectorReferenceGap(form));
      expect(decision.attached).toBe(true);
      expect(decision.connectorRequired).toBe(false);
    }
  });

  it("flowline's real gap (36px) exceeds the connector model's own maximum -- a disclosed placement finding, not a bug to hide with a bigger bridge", () => {
    const decision = resolveStructureConnector(structureConnectorReferenceGap("flowline"));
    expect(decision.exceedsMaximum).toBe(true);
    expect(decision.connectorRequired).toBe(false);
  });

  it("horizon has a real, in-range gap (10px) and requires a connector", () => {
    const decision = resolveStructureConnector(structureConnectorReferenceGap("horizon"));
    expect(decision.attached).toBe(false);
    expect(decision.connectorRequired).toBe(true);
    expect(decision.exceedsMaximum).toBe(false);
    expect(decision.length).toBe(10);
    expect(decision.orientation).toBe("vertical");
  });

  it("reel has a real, in-range gap (8px) and requires a connector, oriented horizontally", () => {
    const decision = resolveStructureConnector(structureConnectorReferenceGap("reel"));
    expect(decision.connectorRequired).toBe(true);
    expect(decision.length).toBe(8);
    expect(decision.orientation).toBe("horizontal");
  });
});
