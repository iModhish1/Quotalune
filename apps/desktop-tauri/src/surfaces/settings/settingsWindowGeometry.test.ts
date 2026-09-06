import { describe, expect, it } from "vitest";

import {
  SETTINGS_WINDOW_HEIGHT,
  SETTINGS_WINDOW_WIDTH,
  fitSettingsWindowSize,
} from "./settingsWindowGeometry";

describe("Settings window geometry", () => {
  it("uses the production gallery size when the work area can hold it", () => {
    expect(fitSettingsWindowSize(1920, 1040)).toEqual({
      width: SETTINGS_WINDOW_WIDTH,
      height: SETTINGS_WINDOW_HEIGHT,
    });
  });

  it("keeps a 16px safe area on smaller displays", () => {
    expect(fitSettingsWindowSize(800, 600)).toEqual({ width: 784, height: 584 });
  });
});
