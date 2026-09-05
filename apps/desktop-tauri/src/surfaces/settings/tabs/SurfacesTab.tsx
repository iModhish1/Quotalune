/** Settings for the single Quota Island overlay. */
import { type ReactNode, useCallback, useEffect, useState } from "react";

import { Toggle } from "../../../components/FormControls";
import { useLocale } from "../../../hooks/useLocale";
import { useSurfaceDemo } from "../../../hooks/useSurfaceDemo";
import { NotchBody } from "../../notch/NotchBody";
import { isNotchForm, notchLayout } from "../../notch/notchGeometry";
import "../../notch/NotchSurface.css";
import {
  FLOW_SURFACE_FORM_CATALOG,
  flowSurfaceAnchorLabel,
  flowSurfaceAnchorOptions,
  flowSurfaceDefaultAnchor,
} from "../../../design-system/flowSurface";
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

function StructureSilhouette({form}:{form:string}) {
  if (!isNotchForm(form)) return <><i/><i/><i/></>;
  const {core}=notchLayout(form,"compact","right",3);
  return <span style={{position:"relative",display:"block",width:58,height:38,background:"#adb2b8",borderRadius:5}}>
    <NotchBody form={form} width={core.width} height={core.height} mirror={false}/>
  </span>;
}

function SurfaceControl({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="surface-control">
      <div className="surface-control__copy">
        <strong>{title}</strong>
        {description && <small>{description}</small>}
      </div>
      <div className="surface-control__action">{children}</div>
    </section>
  );
}

export default function SurfacesTab() {
  const demo = useSurfaceDemo();
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
    <section className="settings-section surface-settings">
      <header className="surface-settings__hero">
        <div>
          <span className="surface-settings__eyebrow">SURFACE STUDIO</span>
          <h3 className="settings-section__title">A surface that respects your workspace</h3>
          <p className="settings-section__description">
            Compact when you are working. Detailed only when you ask for it. Every structure uses the same quota data.
          </p>
        </div>
        <div className="surface-settings__preview" data-form={config.topArcForm} aria-label={`${config.topArcForm} structure preview`}>
          {isNotchForm(config.topArcForm) ? <StructureSilhouette form={config.topArcForm}/> : <><span className="surface-settings__preview-mark" /><i/><i/><i/></>}
        </div>
      </header>

      <div className="surface-settings__grid">
        <SurfaceControl title="Temporary demo" description="Six synthetic providers. No accounts, credentials or history are changed. Turns off when the app exits.">
          <Toggle checked={demo.enabled} ariaLabel="Use six demo providers" disabled={false} onChange={value => { void demo.toggle(value); }} />
          <button type="button" onClick={() => {
            patch({ topArcEnabled: true, topArcForm: "seam", topArcAnchor: "right" });
            void demo.toggle(true);
          }}>Try Seam · six providers</button>
          {demo.error && <p role="alert">{demo.error}</p>}
        </SurfaceControl>
        <div className="surface-settings__column">
          <SurfaceControl title="Show surface" description="Keep a compact quota control within reach without covering your work.">
          <Toggle
            checked={config.topArcEnabled}
            ariaLabel="Show QuotaArc Surface"
            disabled={false}
            onChange={(topArcEnabled) => patch({ topArcEnabled })}
          />
          </SurfaceControl>
          <SurfaceControl title="Opacity">
          <RangeControl label="Opacity" value={config.topArcOpacity} min={30} max={100} step={5} disabled={!config.topArcEnabled} onChange={(topArcOpacity) => patch({ topArcOpacity })} />
          </SurfaceControl>
          <SurfaceControl title="Scale" description="Affects only this surface, never your desktop or other panels.">
          <RangeControl label="Scale" value={config.topArcScale} min={75} max={125} step={5} disabled={!config.topArcEnabled} onChange={(topArcScale) => patch({ topArcScale })} />
          </SurfaceControl>
        </div>

        <div className="surface-settings__column">
          <fieldset className="surface-structure-picker" disabled={!config.topArcEnabled}>
            <legend>Structure</legend>
            <p>Changes the silhouette and placement behavior, never the quota logic.</p>
            <div className="surface-structure-picker__choices">
              {FLOW_SURFACE_FORM_CATALOG.map(({ id: form, name, description: note }) => (
                <button
                  key={form}
                  type="button"
                  className="surface-structure-choice"
                  data-form={form}
                  data-selected={config.topArcForm === form}
                  aria-pressed={config.topArcForm === form}
                  onClick={() => patch({ topArcForm: form, topArcAnchor: flowSurfaceDefaultAnchor(form) })}
                >
                  <span className="surface-structure-choice__shape"><StructureSilhouette form={form}/></span>
                  <strong>{name}</strong>
                  <small>{note}</small>
                </button>
              ))}
            </div>
          </fieldset>
          <SurfaceControl title="Position" description="Choose a safe anchor, or use the larger drag grip on the surface for free placement.">
          <select
            value={config.topArcAnchor}
            disabled={!config.topArcEnabled}
            aria-label="QuotaArc surface position"
            onChange={(event) => patch({ topArcAnchor: event.target.value as SurfaceSettings["topArcAnchor"] })}
          >
            {flowSurfaceAnchorOptions(config.topArcForm).map((anchor) => (
              <option key={anchor} value={anchor}>{flowSurfaceAnchorLabel(config.topArcForm, anchor)}</option>
            ))}
          </select>
          </SurfaceControl>
          <SurfaceControl title="Restore position" description="Returns this structure to its compact default anchor.">
          <button
            type="button"
            disabled={!config.topArcEnabled}
            onClick={() => {
              void resetQuotaIslandPosition().then(() =>
                setConfig((current) => current ? {
                  ...current,
                  topArcAnchor: flowSurfaceDefaultAnchor(current.topArcForm),
                  topArcPlacement: "top-center",
                } : current),
              ).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
            }}
          >
            Restore default position
          </button>
          </SurfaceControl>
        </div>

        <div className="surface-settings__column surface-settings__column--behavior">
          <SurfaceControl title="Auto-hide" description="Retracts to a small reachable tab after the pointer leaves.">
          <Toggle checked={config.topArcAutoHide} ariaLabel="Auto-hide QuotaArc surface" disabled={!config.topArcEnabled} onChange={(topArcAutoHide) => patch({ topArcAutoHide })} />
          </SurfaceControl>
          <SurfaceControl title="Hide delay" description="How long the compact surface stays visible after the pointer leaves.">
          <RangeControl label="Auto-hide delay" value={config.topArcAutoHideDelayMs} min={300} max={3000} step={100} disabled={!config.topArcEnabled || !config.topArcAutoHide} onChange={(topArcAutoHideDelayMs) => patch({ topArcAutoHideDelayMs })} />
          </SurfaceControl>
          <SurfaceControl title="Click-through" description="Mouse input passes through the compact surface.">
          <Toggle checked={config.topArcClickThrough} ariaLabel="QuotaArc compact click-through" disabled={!config.topArcEnabled} onChange={(topArcClickThrough) => patch({ topArcClickThrough })} />
          </SurfaceControl>
          <SurfaceControl title="Fullscreen privacy" description="Hide the surface while games and video use the whole screen.">
          <Toggle checked={config.topArcHideFullscreen} ariaLabel="Hide QuotaArc surface during fullscreen apps" disabled={!config.topArcEnabled} onChange={(topArcHideFullscreen) => patch({ topArcHideFullscreen })} />
          </SurfaceControl>
        </div>
      </div>
      <p className="settings-section__hint">
        Notch structures reveal details after a short hover or a click. Move away to collapse, or pin details to keep them open. Auto-hide restores a small reveal tab.
      </p>
    </section>
  );
}
