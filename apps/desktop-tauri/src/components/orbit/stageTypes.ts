export type UsageMode = "used" | "remaining" | "hybrid";
/**
 * Wave 1F §13: `"error"`/`"timeout"` are real, non-fabricated additions --
 * `toStageProviders()` (stageProviders.ts) derives them from
 * `ProviderUsageSnapshot.error`, the same field `MenuCard.tsx`'s Dashboard
 * card already reads (see `LOADING_STATE_MATRIX.md`'s Wave 1F section for
 * the full source trace). `"timeout"` specifically means the backend's
 * own per-fetch timeout fired (`commands/providers.rs`'s
 * `tokio::time::timeout(...)` wrapper, surfaced as the exact string
 * `error === "Timeout"`) -- not inferred from elapsed wall-clock time on
 * the frontend. `"offline"` keeps its pre-existing meaning: no error, but
 * genuinely no data (e.g. `structureFixtures.ts`'s
 * `syntheticUnavailableProvider()`) -- a status `toStageProviders()`
 * itself does not produce today, only fixtures/future callers that know
 * a provider has no data yet without an error.
 */
export type ProviderStatus = "ok" | "attention" | "offline" | "error" | "timeout";
export interface StageUsageWindow {
  id:string;
  label:string;
  primaryValue:number|null;
  primaryLabel:"used"|"remaining";
  arcFraction:number|null;
  reset:string;
  resetsAt:string|null;
}

/** Render-ready provider data shared by every catalog-themed surface. */
export interface StageProvider {
  id: string;
  name: string;
  iconId: string;
  resolvedMode: UsageMode;
  arcFraction: number | null;
  primaryValue: number | null;
  secondaryValue: number | null;
  primaryLabel: "used" | "remaining";
  reset: string;
  status: ProviderStatus;
  accountLabel?: string | null;
  /** Real plan/package label from the provider snapshot (e.g. "Pro-5x",
   *  "Plus", "Team") when the provider reports one — never fabricated.
   *  Wave 6 Phase 4: threaded through from ProviderUsageSnapshot.planName,
   *  which existing surfaces (MenuCard) already display; FlowSurface's
   *  focused-provider identity previously had no access to it. */
  planName?: string | null;
  windows?: StageUsageWindow[];
  detailsHidden?: boolean;
  limitPresentation?: import('../../design-system/limitPresentation').LimitPresentation;
}
