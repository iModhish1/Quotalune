import {
  applyUsageSemantics,
  resolveUsageMode,
  type UsageDisplayConfig,
} from "../../design-system/themes";
import type { ProviderUsageSnapshot, RateWindowSnapshot } from "../../types/bridge";
import type { StageProvider } from "./stageTypes";
import {isLimitPresentation,resolveLimitPresentation} from '../../design-system/limitPresentation';
import {
  formatResetPresentation,
  type ResetPresentationConfig,
  type ResetTranslate,
} from "../../lib/resetPresentation";

function remainingOf(provider: ProviderUsageSnapshot): number | null {
  const window = provider.selectedMetric ?? provider.primary;
  return windowRemaining(window);
}

function windowRemaining(window: RateWindowSnapshot | null): number | null {
  if (!window) return null;
  if (typeof window.remainingPercent === "number") {
    if (!Number.isFinite(window.remainingPercent)) return null;
    return Math.max(0, Math.min(1, window.remainingPercent / 100));
  }
  if (!Number.isFinite(window.usedPercent)) return null;
  return Math.max(0, Math.min(1, 1 - window.usedPercent / 100));
}

/** Options threading the live UI locale into the one authoritative reset
 *  formatter. Optional and English-default so every existing call site
 *  (and its tests) keeps working unchanged; real surfaces pass the app's
 *  actual locale via `useLocale()` to get correctly localized reset text. */
export interface StageResetOptions {
  locale?: string;
  translate?: ResetTranslate;
  now?: number;
  /** The user's persisted Reset Presentation config (global or a
   *  surface-specific override). Defaults to countdown-only when omitted,
   *  matching the product's pre-existing behavior. */
  config?: Partial<ResetPresentationConfig>;
}

/** The single reset-text pipeline for every stage-driven surface. Prefers
 *  the authoritative `resetsAt` instant, live-formatted via
 *  `formatResetPresentation`; falls back to the backend's pre-formatted
 *  `resetDescription` (stripped of its own "Resets in " prefix, which the
 *  caller supplies separately) when `resetsAt` is absent or unparseable --
 *  never fabricates a value. Joins every enabled module's compact text with
 *  " · " (e.g. "51m · Sep 12 · 19:00") so the one string this field carries
 *  still reflects the user's full module selection, not just a countdown. */
function formatWindowReset(window: RateWindowSnapshot | null | undefined, options?: StageResetOptions): string {
  const description = window?.resetDescription ?? "";
  const fallback = () => {
    const shortened = description.replace(/^resets?\s+(in\s+)?/i, "").trim();
    return shortened.length > 0 ? shortened : "—";
  };
  if (!window?.resetsAt) return fallback();
  const result = formatResetPresentation({
    resetAt: window.resetsAt,
    now: options?.now,
    locale: options?.locale ?? "en-US",
    translate: options?.translate,
    config: options?.config ?? { preset: "countdownOnly", modules: ["countdown"] },
  });
  if (!result.isValid) return fallback();
  const parts = result.orderedParts
    .map((part) => {
      if (part === "countdown") return result.countdown?.short;
      if (part === "date") return result.date?.short;
      if (part === "time") return result.time?.short;
      if (part === "weekday") return result.weekday;
      if (part === "timezone") return result.timezone;
      return undefined;
    })
    .filter((value): value is string => Boolean(value));
  if (parts.length === 0) return fallback();
  return parts.join(" · ");
}

function resetOf(provider: ProviderUsageSnapshot, options?: StageResetOptions): string {
  const window = provider.selectedMetric ?? provider.primary;
  return formatWindowReset(window, options);
}

/** Pure raw-snapshot → render contract used by all themed surfaces. */
export function toStageProviders(
  providers: ProviderUsageSnapshot[],
  config: UsageDisplayConfig | undefined,
  resetOptions?: StageResetOptions,
): StageProvider[] {
  return providers.slice(0, 7).map((provider) => {
    const limitOrder = config?.providerLimitOrder?.[provider.providerId];
    const ranks = limitOrder === undefined ? undefined : new Map(
      [...new Set(limitOrder)].map((id, index) => [id, index]),
    );
    const remaining = provider.error == null ? remainingOf(provider) : null;
    const mode = resolveUsageMode(
      config ?? { global: "remaining", providerOverrides: {} },
      provider.providerId,
    );
    const semantics = applyUsageSemantics(mode, remaining);
    return {
      id: provider.providerId,
      name: provider.displayName,
      planName: provider.planName,
      limitPresentation:resolveLimitPresentation(config?.globalLimitPresentation,config?.providerLimitPresentation?.[provider.providerId]),
      iconId: provider.providerId,
      resolvedMode: mode,
      arcFraction: semantics.arc,
      primaryValue: semantics.value,
      secondaryValue: semantics.secondary,
      primaryLabel: semantics.label,
      reset: resetOf(provider, resetOptions),
      status: provider.error ? "offline" : "ok",
      detailsHidden: limitOrder === undefined
        ? config?.providerDetailWindows?.[provider.providerId] === "none"
        : limitOrder.length === 0,
      windows: ([
        ["primary",provider.primaryLabel,provider.primary],
        ["secondary",provider.secondaryLabel,provider.secondary],
        ["model", "Model-specific limit", provider.modelSpecific],
        ["tertiary", provider.tertiaryLabel, provider.tertiary],
        ...(provider.extraRateWindows ?? []).map((extra) =>
          [`extra:${extra.id}`, extra.title, extra.window] as const),
      ] as const).flatMap(([id,label,window])=>{
        if(!window || window.isInformational || id==='extra:reset-credits')return [];
        if (ranks && !ranks.has(id)) return [];
        const selection=ranks ? "all" : config?.providerDetailWindows?.[provider.providerId] ?? "all";
        const weekly=window.windowMinutes===10080 || /weekly|week/i.test(label ?? "");
        const session=window.windowMinutes===300 || /session|5.hour/i.test(label ?? "");
        if (selection==="none" || selection==="weekly" && !weekly || selection==="session" && !session || selection==="both" && !weekly && !session) return [];
        const resolved=applyUsageSemantics(mode,provider.error==null?windowRemaining(window):null);
        return [{id,label:label || (window.windowMinutes===300?"5-hour session":window.windowMinutes===10080?"Weekly":id==="primary"?"Primary limit":id==="secondary"?"Secondary limit":"Additional limit"),
          primaryValue:resolved.value,primaryLabel:resolved.label,arcFraction:resolved.arc,
          reset:formatWindowReset(window,resetOptions),resetsAt:window.resetsAt??null}];
      }).sort((a,b) => ranks ? ranks.get(a.id)! - ranks.get(b.id)! : 0),
    };
  });
}

/** Pure bridge snapshot → normalized display config. */
export function usageConfigFromSnapshot(snapshot: {
  usageDisplayMode?: string | null;
  providerUsageOverrides?: Record<string, string>;
  providerDetailWindows?: Record<string, string>;
  providerLimitOrder?: Record<string, unknown>;
  providerLimitPresentation?: Record<string, unknown>;
  globalLimitPresentation?: unknown;
}): UsageDisplayConfig | undefined {
  if (snapshot.usageDisplayMode == null && !snapshot.providerUsageOverrides && !snapshot.providerDetailWindows && !snapshot.providerLimitOrder && !snapshot.providerLimitPresentation && !snapshot.globalLimitPresentation) {
    return undefined;
  }
  return {
    globalLimitPresentation:isLimitPresentation(snapshot.globalLimitPresentation)?snapshot.globalLimitPresentation:undefined,
    providerLimitPresentation:Object.fromEntries(Object.entries(snapshot.providerLimitPresentation??{}).filter(([,value])=>isLimitPresentation(value))) as UsageDisplayConfig['providerLimitPresentation'],
    providerLimitOrder: Object.fromEntries(
      Object.entries(snapshot.providerLimitOrder ?? {}).flatMap(([provider, ids]) =>
        Array.isArray(ids) && ids.every(id => typeof id === "string" && id.length > 0)
          ? [[provider, [...new Set(ids as string[])]]] : []),
    ),
    providerDetailWindows: Object.fromEntries(Object.entries(snapshot.providerDetailWindows ?? {}).filter(([,v])=>["all","session","weekly","both","none"].includes(v))) as UsageDisplayConfig["providerDetailWindows"],
    global: (snapshot.usageDisplayMode ?? "remaining") as UsageDisplayConfig["global"],
    providerOverrides: Object.fromEntries(
      Object.entries(snapshot.providerUsageOverrides ?? {}).map(([providerId, mode]) => [
        providerId,
        mode as UsageDisplayConfig["global"],
      ]),
    ),
  };
}
