import type { StageProvider } from "../components/orbit/stageTypes";

/**
 * Wave 1D §24: deterministic Dev-only fixture generator for native
 * structure QA. Reuses the EXISTING demo-mode mechanism
 * (`getSurfaceDemoMode`/`setSurfaceDemoMode` in `lib/surfaceDemo.ts`,
 * already wired through `demoMode`/`showDemoBadge` on all 14 forms) rather
 * than inventing a second fixture store — these functions just produce
 * `StageProvider[]` arrays a Dev session can pass to `providers` (or swap
 * in temporarily where `SURFACE_DEMO_PROVIDERS` is currently imported)
 * instead of the fixed 6-provider `SURFACE_DEMO_PROVIDERS` list, to cover
 * the specific edge cases the native QA handoff needs:
 *
 * - synthetic provider counts (1/3/6/12/24/70)
 * - a long provider name / a long reset string
 * - a provider with two usage windows
 * - available / unavailable / loading / error states
 *
 * Every id is prefixed `synthetic-` and every name is prefixed
 * `Synthetic ` so a screenshot or DOM dump can never be mistaken for a
 * real connected account — matching the existing `SURFACE_DEMO_PROVIDERS`
 * convention ("Demo · synthetic data" `accountLabel`) and the wave's own
 * explicit "clearly labeled synthetic" requirement. DEV ONLY: nothing
 * here touches provider caches, accounts, history, or auth, and none of
 * it is reachable from Personal (see `docs/validation/WAVE1_NATIVE_QA_HANDOFF.md`
 * for exactly how to load these in a real Dev session).
 */

const BASE_ROTATION: Array<{ id: string; name: string; used: number; reset: string }> = [
  { id: "claude", name: "Claude", used: 73, reset: "51 min" },
  { id: "codex", name: "OpenAI", used: 21, reset: "2h 14m" },
  { id: "gemini", name: "Gemini", used: 58, reset: "4h 08m" },
  { id: "cursor", name: "Cursor", used: 42, reset: "6h 32m" },
  { id: "deepseek", name: "DeepSeek", used: 36, reset: "1h 45m" },
  { id: "perplexity", name: "Perplexity", used: 64, reset: "3h 20m" },
];

function baseProvider(index: number, suffix: string): StageProvider {
  const source = BASE_ROTATION[index % BASE_ROTATION.length];
  return {
    id: `synthetic-${source.id}-${suffix}`,
    name: `Synthetic ${source.name}`,
    iconId: source.id,
    resolvedMode: "used",
    primaryValue: source.used,
    primaryLabel: "used",
    secondaryValue: 100 - source.used,
    arcFraction: source.used / 100,
    reset: source.reset,
    status: "ok",
    accountLabel: "Demo · synthetic data",
  };
}

/** §23/§24: a fixture of exactly `count` synthetic providers, for the
 * wave's exact required set (1/3/6/12/24/70) or any other count. */
export function syntheticProviderCount(count: number): StageProvider[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => baseProvider(i, String(i)));
}

/** §30/§38: a single provider with a long display name, to prove
 * truncation (not overflow) in the compact/expanded name rows. */
export function syntheticLongProviderName(): StageProvider {
  return {
    ...baseProvider(0, "long-name"),
    name: "Synthetic Enterprise Organization Account — Extended Display Name",
  };
}

/** §30/§38: a single provider with a long, localized-length reset string
 * (the worst case FlowSurface/Reel/Notch's reset-clipping fixes target). */
export function syntheticLongReset(): StageProvider {
  return {
    ...baseProvider(0, "long-reset"),
    reset: "2 days, 14 hours, 22 minutes, 9 seconds from now",
  };
}

/** §38: a provider reporting two usage windows (session + weekly), the
 * case `UsageWindowList`'s paged layout exists for. */
export function syntheticTwoUsageWindows(): StageProvider {
  return {
    ...baseProvider(0, "two-windows"),
    windows: [
      { id: "session", label: "5-hour session", primaryValue: 73, primaryLabel: "used", arcFraction: 0.73, reset: "51 min", resetsAt: null },
      { id: "weekly", label: "Weekly", primaryValue: 7, primaryLabel: "used", arcFraction: 0.07, reset: "4d", resetsAt: null },
    ],
  };
}

/**
 * §26/§32: a provider with no observed value yet ("offline"/unavailable
 * per `StageProvider.status`). Loading itself is the
 * `FlowSurfaceProps.initialLoading` flag (§10), not a provider fixture,
 * since it is a first-fetch signal rather than a per-provider status.
 *
 * Real, disclosed architecture finding from building this fixture:
 * `StageProvider.status` is `"ok" | "attention" | "offline"` only — there
 * is no distinct "error" status at this layer (unlike the raw
 * `ProviderUsageSnapshot.errorState`/`.error` fields `CurrentLimits.tsx`
 * reads from, upstream of the `toStageProviders()` conversion Structures
 * consume). A Structure therefore cannot currently distinguish "provider
 * genuinely has no data" from "the last fetch errored" the way Analytics
 * surfaces can — both fixture identically as `status: "offline"` today.
 * Whether Structures should gain their own error-vs-unavailable
 * distinction is a real product question for the native-capable session
 * to raise with the owner, not something to invent a fake status value
 * for here.
 */
export function syntheticUnavailableProvider(): StageProvider {
  return {
    ...baseProvider(0, "unavailable"),
    arcFraction: null,
    primaryValue: null,
    secondaryValue: null,
    status: "offline",
  };
}
