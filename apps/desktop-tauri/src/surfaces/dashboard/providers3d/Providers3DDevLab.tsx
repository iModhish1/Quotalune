/**
 * Phase 5 owner sections 56/57 -- DEV-only 3D engine lab.
 *
 * Lets a developer drive `ProvidersUniverseScene` with synthetic provider
 * counts (1/6/12/24/70), status mixes, and any catalog Structure Theme --
 * combinations real Dev-channel data cannot reliably produce on demand.
 *
 * HARD GATE: this component's one call site (`App.tsx`, the
 * `?window=providers3d-lab` route) is itself wrapped in an
 * `import.meta.env.DEV` check -- it is never reachable in a production
 * build, and its fixture data (`devFixtures.ts`) never flows into
 * `Providers3DDashboard.tsx`, which uses only `useProviders()`.
 */
import { useMemo, useState } from "react";
import { useSettings } from "../../../hooks/useSettings";
import { THEME_CATALOG, catalogBySlug, CANONICAL_THEME } from "../../../design-system/themeCatalog";
import type { BootstrapState, DashboardPerformancePreset } from "../../../types/bridge";
import ProvidersUniverseScene from "./ProvidersUniverseScene";
import { buildDevProviderFixtures, DEV_FIXTURE_PRESET_COUNTS, type DevFixtureStatusMix } from "./devFixtures";
import "./Providers3DDevLab.css";

const PERFORMANCE_PRESETS: DashboardPerformancePreset[] = ["lowCpu", "balanced", "highFidelity"];
const STATUS_MIXES: DevFixtureStatusMix[] = ["allReady", "mixedAuth", "mixedAlert"];

export default function Providers3DDevLab({ state }: { state: BootstrapState }) {
  const { settings: realSettings } = useSettings(state.settings);
  const [count, setCount] = useState<number>(12);
  const [statusMix, setStatusMix] = useState<DevFixtureStatusMix>("mixedAlert");
  const [themeSlug, setThemeSlug] = useState<string>(CANONICAL_THEME.slug);
  const [preset, setPreset] = useState<DashboardPerformancePreset>("balanced");
  const [forceReducedMotion, setForceReducedMotion] = useState(false);

  const fixtures = useMemo(() => buildDevProviderFixtures({ count, statusMix }), [count, statusMix]);
  const theme = catalogBySlug(themeSlug) ?? CANONICAL_THEME;

  // Local override -- never persisted, never touches the real settings
  // bridge. Only `dashboardPerformancePreset` is swapped for the lab's own
  // control; everything else (thresholds, presentation identity) comes
  // from the real current profile so the lab stays representative.
  const labSettings = useMemo(
    () => ({ ...realSettings, dashboardPerformancePreset: preset }),
    [realSettings, preset],
  );

  return (
    <div className="providers3d-devlab" data-qa-motion={forceReducedMotion ? "reduced" : "full"}>
      <div className="providers3d-devlab__controls" role="group" aria-label="3D Engine Dev Lab controls">
        <label>
          Provider count
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {DEV_FIXTURE_PRESET_COUNTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status mix
          <select value={statusMix} onChange={(e) => setStatusMix(e.target.value as DevFixtureStatusMix)}>
            {STATUS_MIXES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          Structure Theme
          <select value={themeSlug} onChange={(e) => setThemeSlug(e.target.value)}>
            {THEME_CATALOG.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Performance preset
          <select value={preset} onChange={(e) => setPreset(e.target.value as DashboardPerformancePreset)}>
            {PERFORMANCE_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={forceReducedMotion}
            onChange={(e) => setForceReducedMotion(e.target.checked)}
          />
          Force reduced motion (visual marker only -- engine reads the OS
          setting directly)
        </label>
      </div>
      <div className="providers3d-devlab__stage">
        <ProvidersUniverseScene
          liveProviders={fixtures}
          settings={labSettings}
          theme={theme}
          onOpenProviders={() => {
            // eslint-disable-next-line no-console
            console.info("[providers3d-devlab] onOpenProviders invoked");
          }}
        />
      </div>
    </div>
  );
}
