/**
 * QuotaArc motion system.
 *
 * Motion is a first-class product feature, but idle must cost nothing:
 * primitives animate only on state change and never loop on their own.
 * Springs are physical and soft; durations exist only for fades.
 *
 * `MotionLevel` (Full | Reduced | Off) maps to `[data-qa-motion]` on the
 * root element; the system-level `prefers-reduced-motion` media query maps
 * to Reduced unless the app overrides it.
 */
import {
  motion,
  type Transition,
  type HTMLMotionProps,
} from "motion/react";
import {useSyncExternalStore} from "react";

export { motion };

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
function readReducedMotion(): boolean | null {
  return typeof window === "undefined" || typeof window.matchMedia !== "function"
    ? null : window.matchMedia(reducedMotionQuery).matches;
}
/** React to OS changes while mounted; motion/react 13.1.1 only captures mount state. */
export function useReducedMotion(): boolean | null {
  return useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => null);
}

export type MotionLevel = "full" | "reduced" | "off";

export function motionLevelFor(
  setting: MotionLevel | undefined,
  systemReduced: boolean,
): MotionLevel {
  if (setting === "off" || setting === "reduced") return setting;
  return systemReduced ? "reduced" : "full";
}

/** Whether transitions should run at all (Off or Reduced both skip motion). */
export function motionEnabled(level: MotionLevel): boolean {
  return level === "full";
}

/** Canonical springs. Snappy for controls, soft for surfaces/morphs. */
export const springSnappy: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 34,
  mass: 0.9,
};

export const springSoft: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 30,
  mass: 1,
};

export const springGentle: Transition = {
  type: "spring",
  stiffness: 170,
  damping: 26,
  mass: 1,
};

export const fadeFast: Transition = { duration: 0.16, ease: "easeOut" };

export function transitionFor(level: MotionLevel, preferred: Transition): Transition {
  if (!motionEnabled(level)) return { duration: 0 };
  return preferred;
}

/** Standard surface-enter variant used across surfaces. */
export function surfaceEnter(level: MotionLevel): HTMLMotionProps<"div"> {
  if (!motionEnabled(level)) return {};
  return {
    initial: { opacity: 0, y: 6, scale: 0.985 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 4, scale: 0.99 },
    transition: springSoft,
  };
}
