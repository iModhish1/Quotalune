/**
 * Phase 5 owner sections 56/57 -- DEV-only fixture data for the 3D engine
 * lab. This module produces synthetic `ProviderUsageSnapshot[]` arrays for
 * stress-testing provider counts (1/6/12/24/70), theme combinations, and
 * status permutations that real Dev-channel data cannot reliably exercise
 * on demand (e.g. 70 simultaneously-configured providers).
 *
 * HARD RULE (mirrors the rest of the codebase's Dev/Personal separation):
 * this module's output must never reach a production surface. It is only
 * ever imported by `Providers3DDevLab.tsx`, which itself is only reachable
 * behind `import.meta.env.DEV` (see `LocaleProvider.tsx` for the same
 * gating idiom already used in this codebase). Nothing here touches
 * `useProviders()`/the Tauri bridge/the real provider registry.
 */
import type { ProviderUsageSnapshot, RateWindowSnapshot, ProviderStateKind } from "../../../types/bridge";

const FIXTURE_PROVIDER_IDS = [
  "claude", "codex", "openaiapi", "cursor", "xai", "mistral",
  "deepseek", "openrouter", "fireworks", "deepinfra", "bedrock", "litellm",
  "minimax", "llmproxy", "crossmodel", "sub2api", "devin", "neuralwatt",
  "opencodego", "zenmux", "commandcode", "aiand",
] as const;

function fixtureRateWindow(usedPercent: number, resetsAt: string | null): RateWindowSnapshot {
  return {
    usedPercent,
    remainingPercent: Math.max(0, 100 - usedPercent),
    windowMinutes: 43200,
    resetsAt,
    resetDescription: resetsAt ? "monthly" : null,
    isExhausted: usedPercent >= 100,
    reservePercent: null,
    reserveDescription: null,
  };
}

/** Deterministic pseudo-random in [0, 1) from an integer seed -- never
 *  `Math.random()`, so a given fixture count/seed always renders the same
 *  scene (matches the layout engine's own determinism requirement). */
function seeded(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export type DevFixtureStatusMix = "allReady" | "mixedAuth" | "mixedAlert";

export interface DevFixtureOptions {
  count: number;
  statusMix?: DevFixtureStatusMix;
}

function errorStateFor(index: number, mix: DevFixtureStatusMix): ProviderStateKind {
  if (mix === "allReady") return "ready";
  if (mix === "mixedAuth") {
    if (index % 5 === 0) return "needsAuthentication";
    if (index % 7 === 0) return "localRuntimeOffline";
    return "ready";
  }
  return "ready";
}

function usedPercentFor(index: number, mix: DevFixtureStatusMix): number {
  const base = Math.floor(seeded(index + 1) * 100);
  if (mix === "mixedAlert") {
    if (index % 4 === 0) return 96; // critical
    if (index % 4 === 1) return 82; // warning
  }
  return base;
}

/** Builds `count` synthetic provider snapshots (repeating the fixture id
 *  list with a numeric suffix past 22) for Dev-only 3D layout/perf
 *  stress testing. Every field is a plausible, clearly-synthetic value --
 *  never a copy of real observed data. */
export function buildDevProviderFixtures({ count, statusMix = "allReady" }: DevFixtureOptions): ProviderUsageSnapshot[] {
  const nodes: ProviderUsageSnapshot[] = [];
  for (let i = 0; i < count; i += 1) {
    const baseId = FIXTURE_PROVIDER_IDS[i % FIXTURE_PROVIDER_IDS.length];
    const providerId = i < FIXTURE_PROVIDER_IDS.length ? baseId : `${baseId}-fixture-${i}`;
    const usedPercent = usedPercentFor(i, statusMix);
    const resetsAt = new Date(Date.now() + (i + 1) * 3600_000).toISOString();
    nodes.push({
      providerId,
      displayName: `${baseId[0].toUpperCase()}${baseId.slice(1)} (Dev Fixture ${i + 1})`,
      primary: fixtureRateWindow(usedPercent, resetsAt),
      selectedMetric: fixtureRateWindow(usedPercent, resetsAt),
      primaryLabel: "Monthly",
      secondary: null,
      modelSpecific: null,
      tertiary: null,
      extraRateWindows: [],
      cost: null,
      planName: "Dev Fixture Plan",
      accountEmail: null,
      sourceLabel: "devFixture",
      updatedAt: new Date().toISOString(),
      error: null,
      errorState: errorStateFor(i, statusMix),
      pace: null,
      accountOrganization: null,
      trayStatusLabel: null,
      fetchDurationMs: null,
    });
  }
  return nodes;
}

export const DEV_FIXTURE_PRESET_COUNTS = [0, 1, 6, 12, 24, 70] as const;
