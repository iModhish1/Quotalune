export type UsageMode = "used" | "remaining" | "hybrid";
export type ProviderStatus = "ok" | "attention" | "offline";

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
}
