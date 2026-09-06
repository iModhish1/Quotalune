export type SettingsNavigation="side"|"top"|"bottom";
export const SETTINGS_NAVIGATION_KEY="quotaarc.settings.navigation.v1";
export function normalizeSettingsNavigation(value:unknown):SettingsNavigation {
  return value==="top" || value==="bottom"?value:"side";
}

/** Preserve trackpad horizontal input and map an ordinary mouse wheel to the
 * single-row top/bottom strip. */
export function horizontalNavigationScrollDelta(deltaX:number,deltaY:number):number {
  return Math.abs(deltaX)>=Math.abs(deltaY)?deltaX:deltaY;
}

/**
 * Entering Settings may apply its native window geometry once. Switching tabs
 * inside an already-rendered Settings surface must remain a local UI action;
 * routing it through the surface state machine can re-show or re-fit the host
 * window and break Windows maximize/Snap state.
 */
export function shouldTransitionIntoSettings(windowLabel:string,hasSettingsTarget:boolean):boolean {
  return windowLabel!=="settings" && !hasSettingsTarget;
}
