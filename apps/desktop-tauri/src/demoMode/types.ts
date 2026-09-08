/**
 * Phase 5.2: the resolved, in-memory shape of the user-accessible Demo
 * Mode configuration -- derived from the persisted `SettingsSnapshot`
 * fields (`demoModeEnabled`/`demoProviderMode`/... in `types/bridge.ts`,
 * mirroring `quotalis_core::settings::{DemoProviderMode, DemoScenario}`).
 *
 * This is CONFIGURATION only. Nothing in `demoMode/` ever writes to
 * history.db, the provider cache, real profiles, or any credential
 * store -- see docs/validation/DEMO_MODE.md.
 */
import type {
  DemoProviderMode,
  DemoScenario,
  SettingsSnapshot,
} from "../types/bridge";
import {
  DEFAULT_DEMO_PROVIDER_COUNT,
  MAX_DEMO_PROVIDER_COUNT,
  MIN_DEMO_PROVIDER_COUNT,
} from "./constants";

export interface DemoModeConfig {
  enabled: boolean;
  providerMode: DemoProviderMode;
  /** Always clamped to [MIN_DEMO_PROVIDER_COUNT, MAX_DEMO_PROVIDER_COUNT]. */
  providerCount: number;
  /** Only meaningful when `providerMode === "custom"`. */
  providerIds: readonly string[];
  scenario: DemoScenario;
  seed: number;
  historyDays: 7 | 30;
}

function clampCount(value: number | undefined): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : DEFAULT_DEMO_PROVIDER_COUNT;
  return Math.min(MAX_DEMO_PROVIDER_COUNT, Math.max(MIN_DEMO_PROVIDER_COUNT, n));
}

function normalizeHistoryDays(value: number | undefined): 7 | 30 {
  return value === 30 ? 30 : 7;
}

/** Reads the persisted settings fields into a resolved, always-valid
 *  `DemoModeConfig` -- a missing/corrupt field never produces a
 *  degenerate config (e.g. zero providers), matching the same
 *  defensive-normalization discipline the Rust side already applies
 *  (`clamp_demo_provider_count`/`normalize_demo_history_days`). */
export function resolveDemoConfig(settings: Pick<SettingsSnapshot,
  | "demoModeEnabled"
  | "demoProviderMode"
  | "demoProviderCount"
  | "demoProviderIds"
  | "demoScenario"
  | "demoSeed"
  | "demoHistoryDays"
>): DemoModeConfig {
  return {
    enabled: settings.demoModeEnabled ?? false,
    providerMode: settings.demoProviderMode ?? "curated",
    providerCount: clampCount(settings.demoProviderCount),
    providerIds: settings.demoProviderIds ?? [],
    scenario: settings.demoScenario ?? "connectedShowcase",
    seed: settings.demoSeed && settings.demoSeed !== 0 ? settings.demoSeed : 1,
    historyDays: normalizeHistoryDays(settings.demoHistoryDays),
  };
}
