import type {ProviderUsageSnapshot, RateWindowSnapshot, SettingsSnapshot} from "../../types/bridge";
import {observationFreshness} from "./freshness";

export interface CurrentQuotaWindow {key: string; label: string | null; slot: "primary" | "secondary" | "modelSpecific" | "tertiary" | "extra"; window: RateWindowSnapshot;}
export function physicalQuotaWindows(provider: ProviderUsageSnapshot): CurrentQuotaWindow[] {
  const windows: {key: string; label: string | null; slot: CurrentQuotaWindow["slot"]; window: RateWindowSnapshot | null}[] = [
    {key: "primary", slot: "primary", label: provider.primaryLabel ?? null, window: provider.primary},
    {key: "secondary", slot: "secondary", label: provider.secondaryLabel ?? null, window: provider.secondary},
    {key: "modelSpecific", slot: "modelSpecific", label: null, window: provider.modelSpecific},
    {key: "tertiary", slot: "tertiary", label: provider.tertiaryLabel ?? null, window: provider.tertiary},
    ...provider.extraRateWindows.map(item => ({key: `extra:${item.id}`, slot: "extra" as const, label: item.title, window: item.window})),
  ];
  return windows.filter((item): item is CurrentQuotaWindow => item.window != null && !item.window.isInformational)
    .filter(({window}) => Number.isFinite(window.usedPercent) && window.usedPercent >= 0 && window.usedPercent <= 100
      && Number.isFinite(window.remainingPercent) && window.remainingPercent >= 0 && window.remainingPercent <= 100
      && Math.abs(window.usedPercent + window.remainingPercent - 100) <= 0.1);
}
export function currentProviderModel(providers: readonly ProviderUsageSnapshot[], settings: SettingsSnapshot, now: number) {
  return providers.map(provider => {
    const ready = provider.errorState === "ready" && !provider.error;
    const windows = ready ? physicalQuotaWindows(provider) : [];
    const highest = windows.reduce<CurrentQuotaWindow | null>((current, item) => !current || item.window.usedPercent > current.window.usedPercent ? item : current, null);
    const resets = windows.flatMap(item => {
      const time = item.window.resetsAt ? Date.parse(item.window.resetsAt) : NaN;
      return Number.isFinite(time) && time > now ? [{provider, ...item, time}] : [];
    }).sort((a,b) => a.time - b.time);
    return {provider, ready, windows, highest, resets, nextReset: resets[0]?.time ?? null,
      freshness: observationFreshness(provider.updatedAt, settings.effectiveRefreshIntervalSecs, now)};
  });
}
export type CurrentProviderModel = ReturnType<typeof currentProviderModel>[number];
