/** Settings for the single Quota Island overlay. */
import { type ReactNode, useCallback, useEffect, useState } from "react";

import { Select, Toggle } from "../../../components/FormControls";
import { useLocale } from "../../../hooks/useLocale";
import { useSurfaceDemo } from "../../../hooks/useSurfaceDemo";
import {normalizeSurfaceInteractions} from "../../../design-system/surfaceInteractions";
import StructurePreview from "../StructurePreview";
import {getSettingsSnapshot} from "../../../lib/tauri";
import {listen} from "@tauri-apps/api/event";
import {resolveCatalogTheme} from "../../../design-system/themeResolution";
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
    <div className="surface-range">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={`${label} ${value}`}
      />
      <output aria-live="polite">{value}{label === "Auto-hide delay" ? " ms" : "%"}</output>
    </div>
  );
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
  const [catalog,setCatalog]=useState("01-obsidian-orbit");
  useEffect(()=>{
    let alive=true;
    const load=()=>getSettingsSnapshot().then(s=>{if(alive)setCatalog(resolveCatalogTheme(s,"top").slug);}).catch(()=>{});
    void load();
    const subscription=listen("quotalis:settings-updated",()=>{void load();}).catch(()=>()=>{});
    return()=>{alive=false;void subscription.then(stop=>stop());};
  },[]);
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
          <StructurePreview form={config.topArcForm} catalog={catalog} maxWidth={144} maxHeight={80}/>
        </div>
      </header>

      <div className="surface-settings__grid">
        <div className="surface-settings__intro-controls">
        <SurfaceControl title="Interaction behavior" description="Shared by every structure. Hover reveals details, the wheel changes providers, and auto-fold restores the compact footprint after you leave.">
          <div className="surface-interactions">
            {([
              ['hoverDetails','Show details on hover','Reveal usage without taking focus.'],
              ['wheelCycle','Cycle with the mouse wheel','Change providers only when the wheel is used.'],
              ['autoFold','Fold details automatically','Return to the compact footprint after you leave.'],
            ] as const).map(([key,label,helper])=>{
              return <div className="surface-interaction" data-disabled={false} key={key}>
                <span><strong>{label}</strong><small>{helper}</small></span>
                <Toggle ariaLabel={label} disabled={false} checked={normalizeSurfaceInteractions(config.interactions)[key]} onChange={checked=>patch({interactions:{...normalizeSurfaceInteractions(config.interactions),[key]:checked}})}/>
              </div>;
            })}
            <label className="surface-interaction surface-interaction--number">
              <span><strong>Fold delay</strong><small>Pause before returning to the compact state.</small></span>
              <span className="surface-number"><input aria-label="Fold delay (ms)" type="number" min={100} max={3000} step={100} disabled={!normalizeSurfaceInteractions(config.interactions).autoFold} value={normalizeSurfaceInteractions(config.interactions).foldDelayMs} onChange={e=>patch({interactions:normalizeSurfaceInteractions({...config.interactions,foldDelayMs:Number(e.target.value)})})}/><small>ms</small></span>
            </label>
          </div>
        </SurfaceControl>
        <SurfaceControl title="Temporary demo" description="Six synthetic providers. No accounts, credentials or history are changed. Turns off when the app exits.">
          <div className="surface-demo-action">
          <Toggle checked={demo.enabled} ariaLabel="Use six demo providers" disabled={false} onChange={value => { void demo.toggle(value); }} />
          <button type="button" onClick={() => {
            patch({ topArcEnabled: true, topArcForm: "seam", topArcAnchor: "right" });
            void demo.toggle(true);
          }}><span>Preview Seam</span><small>Six sample providers</small></button>
          </div>
          {demo.error && <p role="alert">{demo.error}</p>}
        </SurfaceControl>
        </div>
        <div className="surface-settings__column">
          <SurfaceControl title="Show surface" description="Keep a compact quota control within reach without covering your work.">
          <Toggle
            checked={config.topArcEnabled}
            ariaLabel="Show Quotalis Surface"
            disabled={false}
            onChange={(topArcEnabled) => patch({ topArcEnabled })}
          />
          </SurfaceControl>
          <SurfaceControl title="Opacity">
          <RangeControl label="Opacity" value={config.topArcOpacity} min={30} max={100} step={5} disabled={!config.topArcEnabled} onChange={(topArcOpacity) => patch({ topArcOpacity })} />
          </SurfaceControl>
          <SurfaceControl title={`Size · ${config.topArcScale}%`} description="Resize the current structure. Does not change desktop scaling. Small structures offer a lower starting footprint.">
          <div>
          <div className="surface-size-presets" role="group" aria-label="Surface size presets">
            {([{label:"Small",value:75},{label:"Default",value:100},{label:"Large",value:125}] as const).map(preset =>
              <button key={preset.value} type="button" disabled={!config.topArcEnabled} aria-pressed={config.topArcScale===preset.value}
                onClick={()=>patch({topArcScale:preset.value})}>{preset.label} · {preset.value}%</button>)}
          </div>
          <RangeControl label="Scale" value={config.topArcScale} min={75} max={125} step={5} disabled={!config.topArcEnabled} onChange={(topArcScale) => patch({ topArcScale })} />
          </div>
          </SurfaceControl>
        </div>

        <div className="surface-settings__column surface-settings__column--behavior">
          <SurfaceControl title="Auto-hide" description="Retracts to a small reachable tab after the pointer leaves.">
          <Toggle checked={config.topArcAutoHide} ariaLabel="Auto-hide Quotalis surface" disabled={!config.topArcEnabled} onChange={(topArcAutoHide) => patch({ topArcAutoHide })} />
          </SurfaceControl>
          <SurfaceControl title="Hide delay" description="How long the compact surface stays visible after the pointer leaves.">
          <RangeControl label="Auto-hide delay" value={config.topArcAutoHideDelayMs} min={300} max={3000} step={100} disabled={!config.topArcEnabled || !config.topArcAutoHide} onChange={(topArcAutoHideDelayMs) => patch({ topArcAutoHideDelayMs })} />
          </SurfaceControl>
          <SurfaceControl title="Click-through" description="Mouse input passes through the compact surface.">
          <Toggle checked={config.topArcClickThrough} ariaLabel="Quotalis compact click-through" disabled={!config.topArcEnabled} onChange={(topArcClickThrough) => patch({ topArcClickThrough })} />
          </SurfaceControl>
          <SurfaceControl title="Fullscreen privacy" description="Hide the surface while games and video use the whole screen.">
          <Toggle checked={config.topArcHideFullscreen} ariaLabel="Hide Quotalis surface during fullscreen apps" disabled={!config.topArcEnabled} onChange={(topArcHideFullscreen) => patch({ topArcHideFullscreen })} />
          </SurfaceControl>
        </div>

        <div className="surface-settings__column surface-settings__column--catalog">
          <fieldset className="surface-structure-picker" disabled={!config.topArcEnabled}>
            <legend>Structure</legend>
            <div className="surface-structure-picker__meta">
              <p>Choose a distinct silhouette. Every card is rendered by the real surface component with the active identity.</p>
              <output>{FLOW_SURFACE_FORM_CATALOG.length} structures</output>
            </div>
            <div className="surface-structure-picker__choices">
              {FLOW_SURFACE_FORM_CATALOG.map(({ id: form, name, description: note }) => (
                <article
                  key={form}
                  className="surface-structure-choice"
                  data-form={form}
                  data-selected={config.topArcForm === form}
                >
                  <StructurePreview form={form} catalog={catalog} showDimensions/>
                  <button type="button" aria-pressed={config.topArcForm===form}
                    onClick={()=>patch({topArcForm:form,topArcAnchor:flowSurfaceDefaultAnchor(form)})}>
                  <span className="surface-structure-choice__title"><strong>{name}</strong>{config.topArcForm===form&&<span>Selected</span>}</span>
                  <small>{note}</small>
                  </button>
                </article>
              ))}
            </div>
          </fieldset>
          <div className="surface-settings__docking-row">
          <SurfaceControl title="Position" description="Choose a safe anchor, or use the larger drag grip on the surface for free placement.">
          <Select
            value={config.topArcAnchor}
            disabled={!config.topArcEnabled}
            ariaLabel="Quotalis surface position"
            onChange={(value) => patch({ topArcAnchor: value as SurfaceSettings["topArcAnchor"] })}
            options={flowSurfaceAnchorOptions(config.topArcForm).map((anchor) => ({
              value: anchor,
              label: flowSurfaceAnchorLabel(config.topArcForm, anchor),
            }))}
          />
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
        </div>
      </div>
      <p className="settings-section__hint">
        Notch structures reveal details after a short hover or a click. Move away to collapse, or pin details to keep them open. Auto-hide restores a small reveal tab.
      </p>
    </section>
  );
}
