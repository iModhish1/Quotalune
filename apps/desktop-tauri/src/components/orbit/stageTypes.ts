export type UsageMode = "used" | "remaining" | "hybrid";
export type ProviderStatus = "ok" | "attention" | "offline";
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
