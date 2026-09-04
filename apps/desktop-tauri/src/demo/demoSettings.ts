import type { DesignSystemContextValue } from "../design-system";

/** URL-safe motion override for deterministic visual proof routes. */
export function demoMotionSetting(
  value: string | null,
): DesignSystemContextValue["motionSetting"] {
  if (value === "reduced" || value === "off") return value;
  return "auto";
}
