/**
 * QuotaArc V6 — Theme engine + Usage Display Mode semantics.
 *
 * Themes are token overrides (premium-bounded): a theme may change surface
 * tones, material, glass amount, and accent intensity — never layout,
 * geometry, or status semantics.
 *
 * Usage modes: USED / REMAINING / HYBRID, resolved per provider from a
 * global default with optional per-provider overrides (future-safe hook for
 * account-level overrides).
 */

import { normalizePercentage } from "./percent";

export type UsageMode = "used" | "remaining" | "hybrid";

export interface UsageDisplayConfig {
  providerDetailWindows?: Record<string, "all" | "session" | "weekly" | "both" | "none">;
  /** Ordered selected source IDs. Missing follows legacy/default; [] hides all details. */
  providerLimitOrder?: Record<string, readonly string[]>;
  providerLimitPresentation?: Record<string, import('./limitPresentation').LimitPresentation>;
  /** Shared presentation inherited by providers without an explicit override. */
  globalLimitPresentation?: import('./limitPresentation').LimitPresentation;
  /** Applies to every provider without an override. */
  global: UsageMode;
  /** Provider-level override keyed by provider CLI name. */
  providerOverrides: Record<string, UsageMode>;
  /** Future-safe hook: account-level overrides keyed by account UUID. */
  accountOverrides?: Record<string, UsageMode>;
}

export function resolveUsageMode(
  config: UsageDisplayConfig,
  providerId: string,
  accountId?: string,
): UsageMode {
  if (accountId && config.accountOverrides?.[accountId]) {
    return config.accountOverrides[accountId];
  }
  if (config.providerOverrides[providerId]) {
    return config.providerOverrides[providerId];
  }
  return config.global;
}

/** What the ARC and the VALUE each display for a resolved mode. */
export interface UsageSemantics {
  /** Fraction shown by the arc. */
  arc: number | null;
  /** Number shown prominently. */
  value: number | null;
  /** Secondary small number, when the mode is hybrid. */
  secondary: number | null;
  label: "used" | "remaining";
}

export function applyUsageSemantics(
  mode: UsageMode,
  remaining: number | null,
): UsageSemantics {
  if (remaining == null) {
    return { arc: null, value: null, secondary: null, label: "remaining" };
  }
  // Normalize at the semantics source so no downstream surface ever sees
  // IEEE-754 drift (e.g. 20.999999999999996 from 1 - 0.79).
  const clean = normalizePercentage(remaining * 100);
  if (clean === null) {
    return { arc: null, value: null, secondary: null, label: "remaining" };
  }
  const remainingFraction = clean / 100;
  const used = 1 - remainingFraction;
  // Every emitted number passes normalization: used*100 can re-introduce
  // drift (1 - 0.79 = 0.21000000000000002), so normalize each output.
  const value = normalizePercentage(used * 100) ?? 0;
  const secondary = normalizePercentage(remainingFraction * 100) ?? 0;
  // Product rule (V8.4): the arc ALWAYS displays the same fraction as the
  // primary value, so text, arc endpoint, and accessible name can never
  // disagree. Hybrid keeps the documented contract: primary = used,
  // secondary = remaining, arc follows the remaining fraction.
  switch (mode) {
    case "used":
      return { arc: value / 100, value, secondary, label: "used" };
    case "remaining":
      return { arc: remainingFraction, value: secondary, secondary: value, label: "remaining" };
    case "hybrid":
      return { arc: secondary / 100, value, secondary, label: "used" };
    default:
      // Unknown mode: remaining is the documented safe fallback.
      return { arc: remainingFraction, value: secondary, secondary: value, label: "remaining" };
  }
}

export type V6ThemeId =
  | "obsidian"
  | "graphite"
  | "midnight"
  | "ceramic"
  | "mono"
  | "custom";

export interface V6Theme {
  id: V6ThemeId;
  name: string;
  /** data-qa-v6 attribute value (drives the CSS token overrides). */
  attr: string;
  description: string;
}

export const V6_THEMES: V6Theme[] = [
  { id: "obsidian", name: "Obsidian Orbit", attr: "obsidian", description: "Premium black, vivid provider accents" },
  { id: "graphite", name: "Graphite Precision", attr: "graphite", description: "Technical graphite, subdued" },
  { id: "midnight", name: "Midnight Glass", attr: "midnight", description: "Dark glass, controlled transparency" },
  { id: "ceramic", name: "Ceramic Light", attr: "ceramic", description: "Intentional light mode" },
  { id: "mono", name: "Stealth Mono", attr: "mono", description: "Monochrome; provider color only where needed" },
  { id: "custom", name: "Custom", attr: "custom", description: "User-configured within premium bounds" },
];
