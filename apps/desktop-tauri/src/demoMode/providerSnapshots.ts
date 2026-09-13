/**
 * The one place Demo Mode turns a resolved `DemoModeConfig` into the same
 * `ProviderUsageSnapshot[]` shape production data uses (owner Phase 5.2
 * section 17/18: "Demo creates INPUT DATA. Production selectors
 * calculate OUTPUT ANALYTICS."). Every consumer (2D Dashboard, 3D scene,
 * provider navigator/detail) reads this one array through
 * `useEffectiveProviders()` -- no separate 2D/3D generator (owner section
 * 43).
 */
import type { CostSnapshotBridge, ProviderCatalogEntry, ProviderUsageSnapshot } from "../types/bridge";
import { providerMonetaryQuantityKind } from "../lib/providerMonetaryKind";
import type { DemoModeConfig } from "./types";
import { selectCuratedProviderIds, displayNameFor } from "./curatedProviders";
import { createRng, deriveSeed } from "./rng";
import { buildScenarioProfile, trendShapeFor, type DemoTrendShape } from "./scenarios";

/** Owner Phase 5.2 section 42: the "Monetary Semantics" scenario always
 *  uses these four fixed, real, already-classified providers (see
 *  `sceneModel.ts`'s `PROVIDER_QUANTITY_KIND` table) regardless of the
 *  configured curated/custom list -- one of each real quantity kind, plus
 *  one genuinely unclassified ("Unavailable") provider. Never invented:
 *  claude/codex/gemini are also in the default curated six; `sub2api` is
 *  a real registered provider classified as `"balance"`. */
const MONETARY_SEMANTICS_PROVIDER_IDS: readonly string[] = ["claude", "codex", "sub2api", "gemini"];

export interface ResolvedDemoProviderSnapshot {
  snapshot: ProviderUsageSnapshot;
  trendShape: DemoTrendShape;
}

/** Plausible per-kind monetary magnitude -- never derived from the real
 *  pricing engine (owner section 15: "Do not activate the local pricing
 *  engine"), just a seeded cosmetic figure in a sensible range for the
 *  quantity kind. */
function demoCostFor(providerId: string, seed: number): CostSnapshotBridge | null {
  const kind = providerMonetaryQuantityKind(providerId);
  if (kind === "unknown") return null;
  const rng = createRng(deriveSeed(seed, `cost:${providerId}`));
  const used =
    kind === "spend"
      ? Math.round(rng() * 3800 + 200) / 100 // $2.00 - $40.00
      : kind === "balance"
        ? Math.round(rng() * 5500 + 500) / 100 // $5.00 - $60.00
        : Math.round(rng() * 400 + 60); // 60 - 460 credits
  return {
    used,
    limit: null,
    remaining: null,
    currencyCode: kind === "credits" ? "USD" : "USD",
    period: "monthly",
    resetsAt: null,
    formattedUsed: kind === "credits" ? `${used}` : `$${used.toFixed(2)}`,
    formattedLimit: null,
    balance: kind === "balance" ? used : null,
    formattedBalance: kind === "balance" ? `$${used.toFixed(2)}` : null,
  };
}

function buildOneSnapshot(
  providerId: string,
  index: number,
  config: DemoModeConfig,
  catalog: readonly ProviderCatalogEntry[],
  now: number,
): ResolvedDemoProviderSnapshot {
  const rng = createRng(deriveSeed(config.seed, `provider:${providerId}:${index}`));
  const profile = buildScenarioProfile(config.scenario, index, rng);
  const resetsAt = profile.resetOffsetMs != null ? new Date(now + profile.resetOffsetMs).toISOString() : null;
  const displayName = displayNameFor(providerId, catalog);

  const rateWindow = {
    usedPercent: profile.usedPercent,
    remainingPercent: Math.max(0, 100 - profile.usedPercent),
    windowMinutes: 43_200,
    resetsAt,
    resetDescription: null,
    isExhausted: profile.usedPercent >= 100,
    reservePercent: null,
    reserveDescription: null,
  };

  const snapshot: ProviderUsageSnapshot = {
    providerId,
    displayName,
    primary: rateWindow,
    selectedMetric: rateWindow,
    primaryLabel: "Monthly",
    secondary: providerId === "codex" || providerId === "claude" ? {
      ...rateWindow, windowMinutes: 10080, usedPercent: Math.round(profile.usedPercent * .55),
      remainingPercent: 100 - Math.round(profile.usedPercent * .55), resetsAt: new Date(now + 3 * 86400_000).toISOString(),
    } : null,
    secondaryLabel: providerId === "codex" || providerId === "claude" ? "Weekly" : undefined,
    modelSpecific: null,
    tertiary: null,
    extraRateWindows: [],
    // Synthetic inventory exists only inside the explicitly labelled Demo input.
    resetFacts: {
      observedAt:new Date(now).toISOString(),
      providerIssuedResets:{state:'unavailable',reason:'notReported'},
      lastActualReset:{state:'unavailable',reason:'notObserved'},
      nextWeeklyReset:providerId==='codex'||providerId==='claude'?{state:'known',value:{windowKey:'secondary',resetsAt:new Date(now+3*86400_000).toISOString()}}:{state:'unsupported'},
      bankedResetCards:index%5===4?{state:'unavailable',reason:'notReported'}:{state:'known',value:{
        reportedAvailableCount:index%4,detailsComplete:true,
        cards:Array.from({length:index%4},(_,card)=>({opaqueId:`demo:${providerId}:${card}`,status:'available',expiresAt:{state:'known',value:new Date(now+(card+7)*86400_000).toISOString()}})),
      }},
    },
    cost: profile.errorState === "ready" ? demoCostFor(providerId, config.seed) : null,
    planName: null,
    accountEmail: null,
    // Deliberately distinct from every real `sourceLabel` value this app
    // ever emits ("auto", "cli-session", ...) -- an extra, low-level
    // honesty signal alongside the real provenance flag returned by
    // `useEffectiveProviders()` (owner Phase 5.2 section 1).
    sourceLabel: "demo",
    updatedAt: new Date(now).toISOString(),
    // Owner section 20: a simulated auth-required/rate-limited state must
    // say so explicitly rather than reading like a real failure a user
    // should act on.
    error: profile.errorState === "ready" ? null : "Demo state",
    errorState: profile.errorState,
    pace: null,
    accountOrganization: null,
    trayStatusLabel: null,
    fetchDurationMs: null,
  };

  return { snapshot, trendShape: trendShapeFor(index) };
}

/** Resolves which provider ids this config actually simulates -- curated
 *  (deterministic slice of the real registry) or custom (the user's
 *  explicit list, filtered to ids that still exist in the catalog: owner
 *  section 55, "removed provider ID handled safely"). The Monetary
 *  Semantics scenario always overrides this to its fixed four-provider
 *  set (owner section 42). */
export function resolveDemoProviderIds(
  config: DemoModeConfig,
  catalog: readonly ProviderCatalogEntry[],
): string[] {
  if (config.scenario === "monetarySemantics") {
    const catalogIds = new Set(catalog.map((p) => p.id));
    return MONETARY_SEMANTICS_PROVIDER_IDS.filter((id) => catalogIds.has(id));
  }
  if (config.providerMode === "custom") {
    const catalogIds = new Set(catalog.map((p) => p.id));
    const filtered = config.providerIds.filter((id) => catalogIds.has(id));
    return filtered.length > 0 ? filtered : selectCuratedProviderIds(config.providerCount, catalog);
  }
  return selectCuratedProviderIds(config.providerCount, catalog);
}

/** The one authoritative Demo Mode provider-snapshot builder -- pure,
 *  deterministic (same config + catalog + `now` -> identical output),
 *  and never touches the network, real provider cache, or history.db
 *  (owner Phase 5.2 sections 2/36). `now` is a caller-supplied timestamp
 *  (ms) rather than reading `Date.now()` internally, so callers can
 *  memoize on it and avoid regenerating on every render (owner section
 *  49). */
export function buildDemoProviderSnapshots(
  config: DemoModeConfig,
  catalog: readonly ProviderCatalogEntry[],
  now: number,
): ProviderUsageSnapshot[] {
  if (!config.enabled) return [];
  const ids = resolveDemoProviderIds(config, catalog);
  return ids.map((id, index) => buildOneSnapshot(id, index, config, catalog, now).snapshot);
}

/** Same as `buildDemoProviderSnapshots` but also returns each provider's
 *  deterministic trend shape, for callers (the demo history/dashboard-
 *  snapshot builder) that need to keep a provider's "current" number and
 *  its 7/30-day trend visually consistent with each other. */
export function buildDemoProviderSnapshotsWithTrend(
  config: DemoModeConfig,
  catalog: readonly ProviderCatalogEntry[],
  now: number,
): ResolvedDemoProviderSnapshot[] {
  if (!config.enabled) return [];
  const ids = resolveDemoProviderIds(config, catalog);
  return ids.map((id, index) => buildOneSnapshot(id, index, config, catalog, now));
}
