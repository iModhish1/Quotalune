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
      aria-label={`${label} ${value}`}
      style={{ width: "100%" }}
    />
  );
}

function defaultAnchor(form: SurfaceSettings["topArcForm"]): SurfaceSettings["topArcAnchor"] {
  if (form === "horizon") return "top";
  if (form === "petal") return "bottom-right";
  return "right";
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
      <h3 className="settings-section__title">QuotaArc Surface</h3>
      <p className="settings-section__description">
        A small, transparent status surface that stays out of the way and opens only into available desktop space.
      </p>
      <div className="settings-section__group">
        <Field label="Show QuotaArc Surface" description="Keeps a small quota control within reach without covering your work.">
          <Toggle
            checked={config.topArcEnabled}
            ariaLabel="Show QuotaArc Surface"
            disabled={false}
            onChange={(topArcEnabled) => patch({ topArcEnabled })}
          />
        </Field>
        <Field label="Opacity">
          <RangeControl label="Opacity" value={config.topArcOpacity} min={30} max={100} step={5} disabled={!config.topArcEnabled} onChange={(topArcOpacity) => patch({ topArcOpacity })} />
        </Field>
        <Field label="Display scale" description="Changes only this bounded surface, never the rest of the desktop.">
          <RangeControl label="Scale" value={config.topArcScale} min={75} max={125} step={5} disabled={!config.topArcEnabled} onChange={(topArcScale) => patch({ topArcScale })} />
        </Field>
        <Field label="Structure" description="Changes the silhouette and placement behavior, never the quota logic.">
          <select
            value={config.topArcForm}
            disabled={!config.topArcEnabled}
            aria-label="QuotaArc surface structure"
            onChange={(event) => {
              const topArcForm = event.target.value as SurfaceSettings["topArcForm"];
              patch({ topArcForm, topArcAnchor: defaultAnchor(topArcForm) });
            }}
          >
            <option value="flowline">Flowline — compact edge rail</option>
            <option value="horizon">Horizon — compact top or bottom ribbon</option>
            <option value="petal">Petal — compact corner control</option>
          </select>
        </Field>
        <Field label="Position" description="Choose a safe anchor, or drag the grip to place it freely.">
          <select
            value={config.topArcAnchor}
            disabled={!config.topArcEnabled}
            aria-label="QuotaArc surface position"
            onChange={(event) => patch({ topArcAnchor: event.target.value as SurfaceSettings["topArcAnchor"] })}
          >
            {config.topArcForm === "flowline" && <><option value="right">Right edge</option><option value="left">Left edge</option></>}
            {config.topArcForm === "horizon" && <><option value="top">Top edge</option><option value="bottom">Bottom edge</option></>}
            {config.topArcForm === "petal" && <><option value="bottom-right">Bottom right</option><option value="bottom-left">Bottom left</option><option value="top-right">Top right</option><option value="top-left">Top left</option></>}
            <option value="free">Free placement</option>
          </select>
        </Field>
        <Field label="Restore position" description="Returns the surface to its compact default anchor.">
          <button
            type="button"
            disabled={!config.topArcEnabled}
            onClick={() => {
              void resetQuotaIslandPosition().then(() =>
                setConfig((current) => current ? {
                  ...current,
                  topArcAnchor: defaultAnchor(current.topArcForm),
                  topArcPlacement: "top-center",
                } : current),
              ).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
            }}
          >
            Restore default position
          </button>
        </Field>
        <Field label="Auto-hide" description="Retracts to a small reachable tab after the pointer leaves.">
          <Toggle checked={config.topArcAutoHide} ariaLabel="Auto-hide QuotaArc surface" disabled={!config.topArcEnabled} onChange={(topArcAutoHide) => patch({ topArcAutoHide })} />
        </Field>
        <Field label="Auto-hide delay" description="How long the compact surface stays visible after the pointer leaves.">
          <RangeControl label="Auto-hide delay" value={config.topArcAutoHideDelayMs} min={300} max={3000} step={100} disabled={!config.topArcEnabled || !config.topArcAutoHide} onChange={(topArcAutoHideDelayMs) => patch({ topArcAutoHideDelayMs })} />
        </Field>
        <Field label="Click-through" description="Mouse input passes through the compact surface.">
          <Toggle checked={config.topArcClickThrough} ariaLabel="QuotaArc compact click-through" disabled={!config.topArcEnabled} onChange={(topArcClickThrough) => patch({ topArcClickThrough })} />
        </Field>
        <Field label="Hide during fullscreen apps" description="Games and video can use the entire screen.">
          <Toggle checked={config.topArcHideFullscreen} ariaLabel="Hide QuotaArc surface during fullscreen apps" disabled={!config.topArcEnabled} onChange={(topArcHideFullscreen) => patch({ topArcHideFullscreen })} />
        </Field>
      </div>
      <p className="settings-section__hint">
        The surface is always compact by default. It restores one small reveal tab instead of keeping a large overlay open.
      </p>
    </section>
  );
}
