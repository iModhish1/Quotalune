export const SETTINGS_WINDOW_WIDTH = 900;
export const SETTINGS_WINDOW_HEIGHT = 720;

/** Fit the preferred Settings size inside the current monitor work area. */
export function fitSettingsWindowSize(maxWidth: number, maxHeight: number) {
  return {
    width: Math.max(360, Math.min(SETTINGS_WINDOW_WIDTH, maxWidth - 16)),
    height: Math.max(360, Math.min(SETTINGS_WINDOW_HEIGHT, maxHeight - 16)),
  };
}
