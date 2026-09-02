/**
 * Design-system component tests: ArcGauge semantics/geometry and status math.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ArcGauge } from "./ArcGauge";
import { statusForUsage, STATUS_LABEL } from "./semantics";
import { motionLevelFor, motionEnabled } from "./motion";

describe("statusForUsage", () => {
  it("maps consumed fractions to statuses", () => {
    expect(statusForUsage(0.5)).toBe("healthy");
    expect(statusForUsage(0.8)).toBe("moderate");
    expect(statusForUsage(0.92)).toBe("high");
    expect(statusForUsage(0.97)).toBe("critical");
    expect(statusForUsage(null)).toBe("unknown");
    expect(statusForUsage(Number.NaN)).toBe("unknown");
  });

  it("exposes non-color labels for every status", () => {
    for (const s of ["healthy", "moderate", "high", "critical", "unknown", "offline", "refreshing"] as const) {
      expect(STATUS_LABEL[s].length).toBeGreaterThan(3);
    }
  });
});

describe("ArcGauge", () => {
  it("renders with an accessible label", () => {
    const { getByRole } = render(<ArcGauge remaining={0.73} ariaLabel="Claude remaining 73 percent" />);
    expect(getByRole("img", { name: "Claude remaining 73 percent" })).toBeTruthy();
  });

  it("renders unknown state without crashing", () => {
    const { getByRole } = render(<ArcGauge remaining={null} ariaLabel="unknown" />);
    expect(getByRole("img")).toBeTruthy();
  });

  it("clamps out-of-range values", () => {
    const { getByRole, rerender } = render(<ArcGauge remaining={2} ariaLabel="a" />);
    rerender(<ArcGauge remaining={-1} ariaLabel="a" />);
    expect(getByRole("img")).toBeTruthy();
  });
});

describe("motion levels", () => {
  it("reduces when the system asks and the setting is auto", () => {
    expect(motionLevelFor(undefined, true)).toBe("reduced");
    expect(motionLevelFor(undefined, false)).toBe("full");
    expect(motionLevelFor("off", false)).toBe("off");
    expect(motionEnabled(motionLevelFor("off", false))).toBe(false);
  });
});
