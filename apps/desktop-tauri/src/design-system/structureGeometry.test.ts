import { describe, expect, it } from "vitest";
import { structureDetailsMinContentHeight } from "./structureGeometry";

describe("structureDetailsMinContentHeight", () => {
  it("accounts for the header row alone when no provider identity or metric rows render", () => {
    const height = structureDetailsMinContentHeight({ hasProviderIdentity: false, metricRows: 1 });
    // header (21) + one metric row (17) + one gap (8) + safe inset*2 (20)
    expect(height).toBe(21 + 17 + 8 + 20);
  });

  it("grows when the focused-provider identity row is present", () => {
    const without = structureDetailsMinContentHeight({ hasProviderIdentity: false, metricRows: 1 });
    const withIdentity = structureDetailsMinContentHeight({ hasProviderIdentity: true, metricRows: 1 });
    expect(withIdentity).toBeGreaterThan(without);
  });

  it("grows when the metrics block renders a second row (the 'Resets …' line)", () => {
    const oneRow = structureDetailsMinContentHeight({ hasProviderIdentity: true, metricRows: 1 });
    const twoRows = structureDetailsMinContentHeight({ hasProviderIdentity: true, metricRows: 2 });
    // This is the exact defect this contract exists to prevent: without the
    // extra row's height (+ its gap) accounted for, a fixed-height details
    // panel's overflow:hidden silently clips the reset-text line.
    expect(twoRows).toBeGreaterThan(oneRow);
  });

  it("matches the worst-case shape (identity row + reset line) used by FlowSurface's tuned petal/orbital/lens/horizon heights", () => {
    // The tuned per-form heights this guards (petal 140, orbital/lens 146,
    // horizon 140, all pre-scale) must stay >= this worst-case floor at the
    // default 100% scale factor, or the max() clamp in FlowSurface.css
    // would silently grow every one of those forms on every render.
    const worstCase = structureDetailsMinContentHeight({ hasProviderIdentity: true, metricRows: 2 });
    expect(worstCase).toBeLessThanOrEqual(140);
  });
});
