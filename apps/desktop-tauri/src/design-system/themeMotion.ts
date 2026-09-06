import type { CSSProperties } from "react";

import type { CatalogTheme } from "./themeCatalog";

export type CatalogMotionCharacter =
  | "orbit"
  | "bloom"
  | "detent"
  | "float"
  | "constellation"
  | "rail"
  | "corona"
  | "facet"
  | "orchid"
  | "frost"
  | "gravity"
  | "nova"
  | "shutter"
  | "reticle"
  | "dune";

export interface CatalogMotionProfile {
  character: CatalogMotionCharacter;
  durationMs: number;
  easing: string;
  focusScale: number;
  hoverLiftPx: number;
  enterX: string;
  enterY: string;
  enterRotate: string;
  enterScale: number;
  staggerMs: number;
}

type MotionPreset = Omit<CatalogMotionProfile, "durationMs">;

const PRESETS: Record<string, MotionPreset> = {
  "01-obsidian-orbit": { character: "orbit", easing: "cubic-bezier(0.22, 1, 0.36, 1)", focusScale: 1.09, hoverLiftPx: -2, enterX: "-5px", enterY: "7px", enterRotate: "-7deg", enterScale: 0.94, staggerMs: 18 },
  "02-aurora-bloom": { character: "bloom", easing: "cubic-bezier(0.16, 1.12, 0.3, 1)", focusScale: 1.14, hoverLiftPx: -4, enterX: "0px", enterY: "12px", enterRotate: "-5deg", enterScale: 0.72, staggerMs: 24 },
  "03-solar-ember": { character: "detent", easing: "cubic-bezier(0.2, 0.78, 0.24, 1)", focusScale: 1.07, hoverLiftPx: -1, enterX: "0px", enterY: "0px", enterRotate: "-12deg", enterScale: 0.98, staggerMs: 15 },
  "04-porcelain-halo": { character: "float", easing: "cubic-bezier(0.22, 0.84, 0.3, 1)", focusScale: 1.08, hoverLiftPx: -3, enterX: "0px", enterY: "7px", enterRotate: "0deg", enterScale: 0.97, staggerMs: 20 },
  "05-noir-constellation": { character: "constellation", easing: "cubic-bezier(0.16, 1, 0.3, 1)", focusScale: 1.08, hoverLiftPx: -2, enterX: "-4px", enterY: "3px", enterRotate: "4deg", enterScale: 0.82, staggerMs: 28 },
  "06-halo-spine": { character: "rail", easing: "cubic-bezier(0.18, 0.9, 0.32, 1.08)", focusScale: 1.1, hoverLiftPx: -1, enterX: "14px", enterY: "0px", enterRotate: "0deg", enterScale: 0.96, staggerMs: 17 },
  "07-eclipse-dial": { character: "corona", easing: "cubic-bezier(0.16, 1, 0.3, 1)", focusScale: 1.1, hoverLiftPx: -2, enterX: "0px", enterY: "0px", enterRotate: "0deg", enterScale: 0.84, staggerMs: 21 },
  "08-prism-zenith": { character: "facet", easing: "cubic-bezier(0.2, 0.9, 0.24, 1)", focusScale: 1.09, hoverLiftPx: -2, enterX: "3px", enterY: "5px", enterRotate: "12deg", enterScale: 0.85, staggerMs: 22 },
  "09-quantum-orchid": { character: "orchid", easing: "cubic-bezier(0.16, 1.08, 0.3, 1)", focusScale: 1.13, hoverLiftPx: -4, enterX: "0px", enterY: "9px", enterRotate: "-14deg", enterScale: 0.72, staggerMs: 25 },
  "10-celestial-ice": { character: "frost", easing: "cubic-bezier(0.22, 0.82, 0.36, 1)", focusScale: 1.07, hoverLiftPx: -2, enterX: "0px", enterY: "-8px", enterRotate: "0deg", enterScale: 0.92, staggerMs: 27 },
  "11-emerald-singularity": { character: "gravity", easing: "cubic-bezier(0.12, 0.88, 0.28, 1.12)", focusScale: 1.11, hoverLiftPx: -2, enterX: "-14px", enterY: "0px", enterRotate: "-3deg", enterScale: 0.9, staggerMs: 23 },
  "12-crimson-nova": { character: "nova", easing: "cubic-bezier(0.12, 0.92, 0.2, 1.08)", focusScale: 1.12, hoverLiftPx: -3, enterX: "0px", enterY: "0px", enterRotate: "0deg", enterScale: 0.55, staggerMs: 13 },
  "13-lunar-titanium": { character: "shutter", easing: "cubic-bezier(0.2, 0.74, 0.26, 1)", focusScale: 1.06, hoverLiftPx: -1, enterX: "0px", enterY: "0px", enterRotate: "18deg", enterScale: 0.9, staggerMs: 16 },
  "14-sapphire-observatory": { character: "reticle", easing: "cubic-bezier(0.18, 0.86, 0.28, 1)", focusScale: 1.08, hoverLiftPx: -2, enterX: "0px", enterY: "-5px", enterRotate: "3deg", enterScale: 0.88, staggerMs: 26 },
  "15-astral-dune": { character: "dune", easing: "cubic-bezier(0.22, 0.78, 0.3, 1)", focusScale: 1.09, hoverLiftPx: -3, enterX: "-10px", enterY: "5px", enterRotate: "-2deg", enterScale: 0.96, staggerMs: 28 },
};

const FALLBACK = PRESETS["01-obsidian-orbit"];

/** Live identities intentionally reuse the bounded motion studies that best
 * match their material character. Slug aliases keep archived concepts out of
 * the selectable catalog without flattening every live theme to Orbit. */
const LIVE_PRESET_ALIASES:Readonly<Record<string,string>>={
  "sapphire-observatory":"14-sapphire-observatory",
  "eclipse-ember":"07-eclipse-dial",
  "aurora-bloom-material":"02-aurora-bloom",
  "solar-ember-material":"03-solar-ember",
  "ceramic-pearl-material":"04-porcelain-halo",
  "smoked-silver":"13-lunar-titanium",
  "tidal-glass":"10-celestial-ice",
  "ember-alloy":"08-prism-zenith",
  "02-graphite-precision":"13-lunar-titanium",
  "03-midnight-glass":"10-celestial-ice",
  "05-stealth-mono":"05-noir-constellation",
  "06-aurora-prism":"09-quantum-orchid",
  "07-solar-pearl":"04-porcelain-halo",
  "08-oceanic-glass":"10-celestial-ice",
  "09-rose-quartz":"09-quantum-orchid",
  "10-verdant-halo":"11-emerald-singularity",
  "11-copper-ember":"03-solar-ember",
  "12-arctic-spectrum":"10-celestial-ice",
  "13-lavender-mist":"02-aurora-bloom",
  "14-sapphire-circuit":"06-halo-spine",
  "15-crimson-atelier":"07-eclipse-dial",
  "17-jade-pavilion":"04-porcelain-halo",
  "33-ink-and-gold":"14-sapphire-observatory",
};

export function catalogMotion(theme: CatalogTheme): CatalogMotionProfile {
  const alias=LIVE_PRESET_ALIASES[theme.slug];
  return { ...(PRESETS[theme.slug] ?? (alias ? PRESETS[alias] : undefined) ?? FALLBACK), durationMs: theme.expansionMs };
}

export type CatalogMotionStyle = CSSProperties & {
  "--qa-theme-motion-duration": string;
  "--qa-theme-motion-easing": string;
  "--qa-theme-motion-focus-scale": number;
  "--qa-theme-motion-lift": string;
  "--qa-theme-motion-enter-x": string;
  "--qa-theme-motion-enter-y": string;
  "--qa-theme-motion-enter-rotate": string;
  "--qa-theme-motion-enter-scale": number;
};

export function catalogMotionStyle(theme: CatalogTheme): CatalogMotionStyle {
  const profile = catalogMotion(theme);
  return {
    "--qa-theme-motion-duration": `${profile.durationMs}ms`,
    "--qa-theme-motion-easing": profile.easing,
    "--qa-theme-motion-focus-scale": profile.focusScale,
    "--qa-theme-motion-lift": `${profile.hoverLiftPx}px`,
    "--qa-theme-motion-enter-x": profile.enterX,
    "--qa-theme-motion-enter-y": profile.enterY,
    "--qa-theme-motion-enter-rotate": profile.enterRotate,
    "--qa-theme-motion-enter-scale": profile.enterScale,
  };
}

export function motionDelay(profile: CatalogMotionProfile, index: number): string {
  return `${Math.max(0, Math.trunc(index)) * profile.staggerMs}ms`;
}
