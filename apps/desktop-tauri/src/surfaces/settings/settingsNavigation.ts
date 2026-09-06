export type SettingsNavigation="side"|"top"|"bottom";
export const SETTINGS_NAVIGATION_KEY="quotaarc.settings.navigation.v1";
export function normalizeSettingsNavigation(value:unknown):SettingsNavigation {
  return value==="top" || value==="bottom"?value:"side";
}
