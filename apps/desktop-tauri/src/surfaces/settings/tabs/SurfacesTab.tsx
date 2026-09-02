/**
 * Surfaces — QuotaArc surface editor (Edge Arc, Top Arc).
 *
 * Live configuration: every change is applied immediately through the
 * surface bridge, so the real surface windows update while editing.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "../../../hooks/useLocale";
import { Field, Select, Toggle } from "../../../components/FormControls";
import {
  getSurfaceSettings,
  updateSurfaceSettings,
  type SurfaceSettings,
} from "../../../lib/surfaceBridge";

function OpacitySlider({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="range"
      min={30}
      max={100}
      step={5}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={`Opacity ${value} percent`}
      style={{ width: "100%" }}
    />
  );
}

function ScaleSlider({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="range"
      min={75}
      max={200}
      step={5}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={`Scale ${value} percent`}
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
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const patch = useCallback((p: Partial<SurfaceSettings>) => {
    setConfig((prev) => (prev ? { ...prev, ...p } : prev));
    void updateSurfaceSettings(p as SurfaceSettings).catch(() => {});
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
    return (
      <section className="settings-section">
        <h3 className="settings-section__title">{t("TabSurfaces")}</h3>
      </section>
    );
  }

  return (
    <>
      <section className="settings-section">
        <h3 className="settings-section__title">
          {t("TrayShowEdgeArc")} · Edge Arc
        </h3>
        <div className="settings-section__group">
          <Field label={t("TrayShowEdgeArc")}>
            <Toggle
              checked={config.edgeArcEnabled}
              disabled={false}
              onChange={(v) => patch({ edgeArcEnabled: v })}
            />
          </Field>
          <Field
            label={t("TabSurfaces") + " — side"}
            description="Attaches the strip to the right or left screen edge."
          >
            <Select
              value={config.edgeArcSide}
              disabled={!config.edgeArcEnabled}
              options={[
                { value: "right", label: "Right edge" },
                { value: "left", label: "Left edge" },
              ]}
              onChange={(v) => patch({ edgeArcSide: v as "left" | "right" })}
            />
          </Field>
          <Field label="Opacity">
            <OpacitySlider
              value={config.edgeArcOpacity}
              disabled={!config.edgeArcEnabled}
              onChange={(v) => patch({ edgeArcOpacity: v })}
            />
          </Field>
          <Field label="Scale">
            <ScaleSlider
              value={config.edgeArcScale}
              disabled={!config.edgeArcEnabled}
              onChange={(v) => patch({ edgeArcScale: v })}
            />
          </Field>
          <Field label="Click-through" description="Mouse input passes through the surface.">
            <Toggle
              checked={config.edgeArcClickThrough}
              disabled={!config.edgeArcEnabled}
              onChange={(v) => patch({ edgeArcClickThrough: v })}
            />
          </Field>
          <Field label="Hide during fullscreen apps" description="Games and video take over the whole screen.">
            <Toggle
              checked={config.edgeArcHideFullscreen}
              disabled={!config.edgeArcEnabled}
              onChange={(v) => patch({ edgeArcHideFullscreen: v })}
            />
          </Field>
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-section__title">
          {t("TrayShowTopArc")} · Top Arc
        </h3>
        <div className="settings-section__group">
          <Field label={t("TrayShowTopArc")}>
            <Toggle
              checked={config.topArcEnabled}
              disabled={false}
              onChange={(v) => patch({ topArcEnabled: v })}
            />
          </Field>
          <Field label="Opacity">
            <OpacitySlider
              value={config.topArcOpacity}
              disabled={!config.topArcEnabled}
              onChange={(v) => patch({ topArcOpacity: v })}
            />
          </Field>
          <Field label="Scale">
            <ScaleSlider
              value={config.topArcScale}
              disabled={!config.topArcEnabled}
              onChange={(v) => patch({ topArcScale: v })}
            />
          </Field>
          <Field label="Click-through" description="Mouse input passes through the surface.">
            <Toggle
              checked={config.topArcClickThrough}
              disabled={!config.topArcEnabled}
              onChange={(v) => patch({ topArcClickThrough: v })}
            />
          </Field>
          <Field label="Hide during fullscreen apps" description="Games and video take over the whole screen.">
            <Toggle
              checked={config.topArcHideFullscreen}
              disabled={!config.topArcEnabled}
              onChange={(v) => patch({ topArcHideFullscreen: v })}
            />
          </Field>
        </div>
      </section>
    </>
  );
}
