/** Settings for the single Quota Island overlay. */
import { useCallback, useEffect, useState } from "react";

import { Field, Toggle } from "../../../components/FormControls";
import { useLocale } from "../../../hooks/useLocale";
import {
  getSurfaceSettings,
  resetQuotaIslandPosition,
  updateSurfaceSettings,
  type SurfaceSettings,
} from "../../../lib/surfaceBridge";

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
      aria-label={`${label} ${value} percent`}
      style={{ width: "100%" }}
    />
  );
}

export default function SurfacesTab() {
  const { t } = useLocale();
  const [config, setConfig] = useState<SurfaceSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSurfaceSettings()
      .then(setConfig)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, []);

  const patch = useCallback((next: Partial<SurfaceSettings>) => {
    setConfig((current) => current ? { ...current, ...next } : current);
    void updateSurfaceSettings(next).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause));
      void getSurfaceSettings().then(setConfig).catch(() => {});
    });
  }, []);

  if (error) {
    return (
      <section className="settings-section">
        <h3 className="settings-section__title">{t("TabSurfaces")}</h3>
        <p className="settings-section__description">{error}</p>
      </section>
    );
  }
  if (!config) {
    return <section className="settings-section"><h3 className="settings-section__title">{t("TabSurfaces")}</h3></section>;
  }

  return (
    <section className="settings-section">
      <h3 className="settings-section__title">Quota Island</h3>
      <p className="settings-section__description">
        A small status island at the top of the screen. It expands downward only when you ask for details.
      </p>
      <div className="settings-section__group">
        <Field label="Show Quota Island" description="Keeps the compact quota summary available above your work.">
          <Toggle
            checked={config.topArcEnabled}
            ariaLabel="Show Quota Island"
            disabled={false}
            onChange={(topArcEnabled) => patch({ topArcEnabled })}
          />
        </Field>
        <Field label="Opacity">
          <RangeControl label="Opacity" value={config.topArcOpacity} min={30} max={100} step={5} disabled={!config.topArcEnabled} onChange={(topArcOpacity) => patch({ topArcOpacity })} />
        </Field>
        <Field label="Display scale" description="Changes only the bounded island, never the rest of the desktop.">
          <RangeControl label="Scale" value={config.topArcScale} min={75} max={200} step={5} disabled={!config.topArcEnabled} onChange={(topArcScale) => patch({ topArcScale })} />
        </Field>
        <Field label="Position" description="Choose a safe edge position, or drag the grip on the island to place it freely.">
          <select
            value={config.topArcPlacement}
            disabled={!config.topArcEnabled}
            aria-label="Quota Island position"
            onChange={(event) => patch({ topArcPlacement: event.target.value as SurfaceSettings["topArcPlacement"] })}
          >
            <option value="top-left">Top left</option>
            <option value="top-center">Top center</option>
            <option value="top-right">Top right</option>
            <option value="free">Free placement</option>
          </select>
        </Field>
        <Field label="Restore position" description="Returns the island to the visible top-center position.">
          <button
            type="button"
            disabled={!config.topArcEnabled}
            onClick={() => {
              void resetQuotaIslandPosition().then(() =>
                setConfig((current) => current ? { ...current, topArcPlacement: "top-center" } : current),
              ).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
            }}
          >
            Center island
          </button>
        </Field>
        <Field label="Click-through" description="Mouse input passes through the compact island.">
          <Toggle checked={config.topArcClickThrough} ariaLabel="Quota Island click-through" disabled={!config.topArcEnabled} onChange={(topArcClickThrough) => patch({ topArcClickThrough })} />
        </Field>
        <Field label="Hide during fullscreen apps" description="Games and video can use the entire screen.">
          <Toggle checked={config.topArcHideFullscreen} ariaLabel="Hide Quota Island during fullscreen apps" disabled={!config.topArcEnabled} onChange={(topArcHideFullscreen) => patch({ topArcHideFullscreen })} />
        </Field>
      </div>
      <p className="settings-section__hint">
        Previous Taskbar and Edge experiments are archived while this shared surface foundation is completed.
      </p>
    </section>
  );
}
