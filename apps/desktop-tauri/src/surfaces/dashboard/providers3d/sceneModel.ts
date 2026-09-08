/**
 * Phase 5: the pure scene-view-model adapter for the 3D Provider Universe.
 *
 * Input: real `ProviderUsageSnapshot[]` (the same live data 2D surfaces
 * already consume — never synthetic), the resolved Structure Theme, the
 * resolved Provider Presentation composition, and the user's configured
 * alert thresholds. Output: a minimal, render-agnostic `ProviderSceneNode[]`.
 *
 * The 3D engine (`engine.ts`) never touches `ProviderUsageSnapshot` or any
 * provider-name `if`/`switch` directly — it only ever reads
 * `ProviderSceneNode`, so provider-specific business logic stays out of
 * rendering code (owner Phase 5 section 37).
 *
 * Money in 3D follows the exact same rules Phase 4A/4A.1/4B/4C already
 * established for the 2D Dashboard (owner section 0/36) — this module
 * does not compute a single new monetary value; it only classifies which
 * of Spend/Balance/Credits/Unavailable a real `CostSnapshotBridge` already
 * is, mirroring `rust/src/dashboard_data.rs::classify_monetary_observation`'s
 * quantity-kind table (Phase 4A.1/4B) for DISPLAY purposes only.
 */
import type { ProviderUsageSnapshot } from "../../../types/bridge";
import type { CatalogTheme } from "../../../design-system/themeCatalog";
import type { ResolvedVisualComposition } from "../../../design-system/visualComposition";
import { selectSingleMetricUsageWindow } from "../../../lib/usageWindows";
import { normalizePercentage } from "../../../design-system/percent";

export type MonetaryQuantityKind = "spend" | "balance" | "credits" | "unknown";

/**
 * Mirrors `provider_cost_measurement_kind`'s QUANTITY dimension from
 * `rust/src/dashboard_data.rs` (Phase 4A.1 "24-provider classification
 * table", re-confirmed in Phase 4B/4C) -- kept as a small, explicitly-
 * sourced display-only table rather than a second independent business
 * rule. Codex's real measurement kind depends on which of its two code
 * paths produced a given reading (Phase 4A.1/4C), but its QUANTITY kind
 * is unconditionally Credits either way, so a single entry is correct
 * here even though the Rust side additionally branches on `period` for
 * the measurement (temporal) dimension, which this display layer does
 * not need.
 */
const PROVIDER_QUANTITY_KIND: Readonly<Record<string, MonetaryQuantityKind>> = {
  crossmodel: "balance",
  sub2api: "balance",
  devin: "balance",
  neuralwatt: "balance",
  opencodego: "balance",
  zenmux: "balance",
  codex: "credits",
  commandcode: "credits",
  aiand: "spend",
  bedrock: "spend",
  claude: "spend",
  cursor: "spend",
  deepinfra: "spend",
  deepseek: "spend",
  fireworks: "spend",
  litellm: "spend",
  llmproxy: "spend",
  minimax: "spend",
  mistral: "spend",
  openaiapi: "spend",
  openrouter: "spend",
  xai: "spend",
};

export function providerMonetaryQuantityKind(providerId: string): MonetaryQuantityKind {
  return PROVIDER_QUANTITY_KIND[providerId] ?? "unknown";
}

export interface ProviderMonetaryState {
  kind: MonetaryQuantityKind;
  /** `null` whenever `kind` is `"unknown"` or no real cost snapshot exists
   *  -- never a fabricated `0`. Always the provider's own reported figure
   *  (Phase 4A rule: ProviderReported, never a Quotalis-computed local
   *  estimate -- none exists for any live observation as of Phase 4C). */
  amount: number | null;
  currencyCode: string | null;
}

function monetaryStateFor(provider: ProviderUsageSnapshot): ProviderMonetaryState {
  if (!provider.cost) return { kind: "unknown", amount: null, currencyCode: null };
  const kind = providerMonetaryQuantityKind(provider.providerId);
  if (kind === "unknown") return { kind, amount: null, currencyCode: null };
  return { kind, amount: provider.cost.used, currencyCode: provider.cost.currencyCode };
}

export type AuthState = "ready" | "needsAuth" | "unavailable";

function authStateFor(provider: ProviderUsageSnapshot): AuthState {
  switch (provider.errorState) {
    case "ready":
      return "ready";
    case "needsAuthentication":
    case "expiredSession":
      return "needsAuth";
    default:
      return "unavailable";
  }
}

export type AlertLevel = "none" | "warning" | "critical";

export interface AlertThresholds {
  highUsageThreshold: number;
  criticalUsageThreshold: number;
}

function alertLevelFor(usedPercent: number | null, thresholds: AlertThresholds): AlertLevel {
  if (usedPercent == null) return "none";
  if (usedPercent >= thresholds.criticalUsageThreshold) return "critical";
  if (usedPercent >= thresholds.highUsageThreshold) return "warning";
  return "none";
}

export interface ProviderSceneNode {
  /** `providerId` -- the existing live-snapshot pipeline carries no
   *  `accountId`, a known, already-documented gap (see
   *  PHASE4_DATA_ACCURACY_AUDIT.md); the 3D scene inherits the exact same
   *  one-node-per-provider granularity the 2D Dashboard's live surfaces
   *  already have, not a new limitation this phase introduces. */
  id: string;
  displayName: string;
  usedPercent: number | null;
  remainingPercent: number | null;
  resetsAt: string | null;
  authState: AuthState;
  alertLevel: AlertLevel;
  monetary: ProviderMonetaryState;
  /** Resolved per Provider Presentation (Follow Structure vs Independent)
   *  -- see `resolveProviderIdentityColor` in `identity.ts`. Stored here,
   *  not recomputed inside the render loop. */
  identityColorHex: string;
}

/**
 * Build the scene's provider nodes from real live data only. Never
 * fabricates a node for a provider with no live snapshot, never invents
 * a percentage/status/monetary value.
 */
export function buildProviderSceneNodes(
  liveProviders: readonly ProviderUsageSnapshot[],
  thresholds: AlertThresholds,
  resolveIdentityColor: (providerId: string) => string,
): ProviderSceneNode[] {
  return liveProviders.map((provider) => {
    const metric = selectSingleMetricUsageWindow(provider);
    const usedPercent = normalizePercentage(metric.usedPercent);
    const remainingPercent = normalizePercentage(metric.remainingPercent);
    return {
      id: provider.providerId,
      displayName: provider.displayName,
      usedPercent,
      remainingPercent,
      resetsAt: metric.resetsAt,
      authState: authStateFor(provider),
      alertLevel: alertLevelFor(usedPercent, thresholds),
      monetary: monetaryStateFor(provider),
      identityColorHex: resolveIdentityColor(provider.providerId),
    };
  });
}

/** Structural theme colors the 3D chamber/structure itself derives from
 *  -- never a hardcoded scene palette (mirrors `useDashboardStructureTheme`'s
 *  reasoning for the 2D Dashboard, Phase 3.6). Provider colors are
 *  intentionally NOT part of this -- they come from `resolveProviderIdentityColor`
 *  per Phase 5 section 17 (Structure Theme != Provider Identity). */
export interface SceneStructureColors {
  chamberBg: [string, string];
  core: string;
  coreEdge: string;
  accent: string;
  hairline: string;
  textPrimary: string;
  textMuted: string;
}

export function structureColorsFromTheme(theme: CatalogTheme): SceneStructureColors {
  return {
    chamberBg: theme.bg,
    core: theme.core,
    coreEdge: theme.coreEdge,
    accent: theme.accent,
    hairline: theme.hairline,
    textPrimary: theme.material?.text ?? "#f0f4f8",
    textMuted: theme.material?.muted ?? "#aeb9c5",
  };
}

export type { ResolvedVisualComposition };
