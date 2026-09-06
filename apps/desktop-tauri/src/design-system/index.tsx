/**
 * QuotaArc design system — public surface.
 *
 * Import from `design-system` only; deep imports are for internal use.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { motionLevelFor, type MotionLevel } from "./motion";
import "./tokens.css";
import "./v2.css";
import "./v6-themes.css";

export { ArcGauge, type ArcGaugeProps } from "./ArcGauge";
export { AnimatedNumber, type AnimatedNumberProps } from "./AnimatedNumber";
export {
  statusForUsage,
  STATUS_TOKEN,
  STATUS_LABEL,
  STATUS_STROKE_BIAS,
  type QuotaStatus,
} from "./semantics";
export {
  motion,
  motionLevelFor,
  motionEnabled,
  springSnappy,
  springSoft,
  springGentle,
  fadeFast,
  transitionFor,
  surfaceEnter,
  type MotionLevel,
} from "./motion";

export interface DesignSystemContextValue {
  /** Light/dark; `system` resolves by OS at the shell layer. */
  theme: "system" | "light" | "dark";
  /** Product motion setting. */
  motionSetting: "auto" | "reduced" | "off";
}

const DesignSystemContext = createContext<DesignSystemContextValue>({
  theme: "system",
  motionSetting: "auto",
});

export function DesignSystemProvider({
  children,
  theme = "system",
  motionSetting = "auto",
}: DesignSystemContextValue & { children: ReactNode }) {
  const value = useMemo(
    () => ({ theme, motionSetting }),
    [theme, motionSetting],
  );
  const systemReduced = useReducedMotion();
  const level: MotionLevel = motionLevelFor(
    motionSetting === "auto" ? undefined : motionSetting,
    systemReduced === true,
  );

  const resolvedTheme = theme === "system" ? "dark" : theme;

  return (
    <DesignSystemContext.Provider value={value}>
      <div
        data-qa-theme={resolvedTheme}
        data-qa-motion={level}
        style={{ display: "contents" }}
      >
        {children}
      </div>
    </DesignSystemContext.Provider>
  );
}

export function useDesignSystem(): DesignSystemContextValue {
  return useContext(DesignSystemContext);
}

// ── V2 component system ──────────────────────────────────────────────
export {
  QaSurface,
  QaCapacityArc,
  QaMicroArc,
  QaValue,
  QaResetTime,
  QaStatusIndicator,
  statusOf,
  QaProfileAvatar,
  QaProviderInstrument,
  QaProviderIcon,
  ArcGaugeV3,
  QaProviderInstrumentMemo,
  type QaEdge,
  type QaMaterial,
  type QaProviderInstrumentProps,
} from "./v2";

// ── V4 physical surface engine ───────────────────────────────────────
export {
  QaPhysicalSurface,
  CHOREOGRAPHY,
  housingPath,
  type QaAnchor,
  type QaPhysicalSurfaceProps,
} from "./PhysicalSurface";

// ── V6 themes + usage modes ──────────────────────────────────────────
export {
  V6_THEMES,
  resolveUsageMode,
  applyUsageSemantics,
  type V6ThemeId,
  type V6Theme,
  type UsageMode,
  type UsageDisplayConfig,
  type UsageSemantics,
} from "./themes";

// ── Numeric formatting ───────────────────────────────────────────────
export {
  normalizePercentage,
  formatPercentage,
  arcFraction,
  formatTokenCount,
} from "./percent";

export { providerGlyphSize } from "./providerIconSizing";
