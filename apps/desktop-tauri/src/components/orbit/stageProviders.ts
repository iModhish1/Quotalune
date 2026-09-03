import {
  applyUsageSemantics,
  resolveUsageMode,
  type UsageDisplayConfig,
} from "../../design-system/themes";
import type { ProviderUsageSnapshot } from "../../types/bridge";
import type { StageProvider } from "./stageTypes";

function remainingOf(provider: ProviderUsageSnapshot): number | null {
  const window = provider.selectedMetric ?? provider.primary;
  if (!window) return null;
  if (typeof window.remainingPercent === "number") {
    return Math.max(0, Math.min(1, window.remainingPercent / 100));
  }
  return Math.max(0, Math.min(1, 1 - window.usedPercent / 100));
}

function resetOf(provider: ProviderUsageSnapshot): string {
  const window = provider.selectedMetric ?? provider.primary;
  const description = window?.resetDescription ?? "";
  const shortened = description.replace(/^resets?\s+(in\s+)?/i, "").trim();
  return shortened.length > 0 ? shortened : "—";
}

/** Pure raw-snapshot → render contract used by all themed surfaces. */
export function toStageProviders(
  providers: ProviderUsageSnapshot[],
  config: UsageDisplayConfig | undefined,
): StageProvider[] {
  return providers.slice(0, 7).map((provider) => {
    const remaining = provider.error == null ? remainingOf(provider) : null;
    const mode = resolveUsageMode(
      config ?? { global: "remaining", providerOverrides: {} },
      provider.providerId,
    );
    const semantics = applyUsageSemantics(mode, remaining);
    return {
      id: provider.providerId,
      name: provider.displayName,
      iconId: provider.providerId,
      resolvedMode: mode,
      arcFraction: semantics.arc,
      primaryValue: semantics.value,
      secondaryValue: semantics.secondary,
      primaryLabel: semantics.label,
      reset: resetOf(provider),
      status: provider.error ? "offline" : "ok",
    };
  });
}

/** Pure bridge snapshot → normalized display config. */
export function usageConfigFromSnapshot(snapshot: {
  usageDisplayMode?: string | null;
  providerUsageOverrides?: Record<string, string>;
}): UsageDisplayConfig | undefined {
  if (snapshot.usageDisplayMode == null && !snapshot.providerUsageOverrides) {
    return undefined;
  }
  return {
    global: (snapshot.usageDisplayMode ?? "remaining") as UsageDisplayConfig["global"],
    providerOverrides: Object.fromEntries(
      Object.entries(snapshot.providerUsageOverrides ?? {}).map(([providerId, mode]) => [
        providerId,
        mode as UsageDisplayConfig["global"],
      ]),
    ),
  };
}
