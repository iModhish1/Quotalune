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

export type UsageMode = "used" | "remaining" | "hybrid";

export interface UsageDisplayConfig {
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
  const used = 1 - remaining;
  switch (mode) {
    case "used":
      // Arc fills forward through consumption; value reads used.
      return { arc: remaining, value: used * 100, secondary: remaining * 100, label: "used" };
    case "remaining":
      // Arc shows what's left; value reads remaining.
      return { arc: remaining, value: remaining * 100, secondary: used * 100, label: "remaining" };
    case "hybrid":
      // Arc shows remaining (spatial intuition), value leads with used.
      return { arc: remaining, value: used * 100, secondary: remaining * 100, label: "used" };
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
