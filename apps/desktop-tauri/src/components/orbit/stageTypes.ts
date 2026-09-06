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
  windows?: StageUsageWindow[];
  detailsHidden?: boolean;
  limitPresentation?: import('../../design-system/limitPresentation').LimitPresentation;
}
