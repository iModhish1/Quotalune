import { describe, expect, it } from "vitest";

import { demoMotionSetting } from "./demoSettings";

describe("demoMotionSetting", () => {
  it("allows explicit reduced and off proof routes", () => {
    expect(demoMotionSetting("reduced")).toBe("reduced");
    expect(demoMotionSetting("off")).toBe("off");
  });

  it("uses the full system-aware runtime for full, missing and invalid values", () => {
    expect(demoMotionSetting("full")).toBe("auto");
    expect(demoMotionSetting(null)).toBe("auto");
    expect(demoMotionSetting("future")).toBe("auto");
  });
});
