/** Settings for the single Quota Island overlay. */
import { type ReactNode, useCallback, useEffect, useState } from "react";

import { Select, Toggle } from "../../../components/FormControls";
import { useLocale } from "../../../hooks/useLocale";
import type { LocaleKey } from "../../../i18n/keys";
import { useSurfaceDemo } from "../../../hooks/useSurfaceDemo";
import {normalizeSurfaceInteractions} from "../../../design-system/surfaceInteractions";
import StructurePreview from "../StructurePreview";
import {getSettingsSnapshot} from "../../../lib/tauri";
import {listen} from "@tauri-apps/api/event";
import {resolveCatalogTheme} from "../../../design-system/themeResolution";
import "../../notch/NotchSurface.css";
import {
  FLOW_SURFACE_FORM_CATALOG,
  flowSurfaceAnchorOptions,
  flowSurfaceDefaultAnchor,
} from "../../../design-system/flowSurface";
import {
  getSurfaceSettings,
  resetQuotaIslandPosition,
  updateSurfaceSettings,
  type SurfaceSettings,
} from "../../../lib/surfaceBridge";

const FORM_NAMES = ["Crescent", "Pebble", "Fan", "Seam", "Ribbon", "Cradle", "Deck", "Satellite", "Flowline", "Reel", "Horizon", "Petal", "Orbital", "Lens"] as const;
const FORM_IDS = ["crescent", "pebble", "fan", "seam", "ribbon", "cradle", "deck", "satellite", "flowline", "reel", "horizon", "petal", "orbital", "lens"] as const;
const ANCHOR_KEYS: Record<SurfaceSettings["topArcAnchor"], LocaleKey> = {
  left: "SurfaceAnchorLeft", right: "SurfaceAnchorRight", top: "SurfaceAnchorTop", bottom: "SurfaceAnchorBottom",
  "top-left": "SurfaceAnchorTopLeft", "top-right": "SurfaceAnchorTopRight", "bottom-left": "SurfaceAnchorBottomLeft",
  "bottom-right": "SurfaceAnchorBottomRight", free: "SurfaceAnchorFree",
};
function formKey(form: string, suffix: "Name" | "Description"): LocaleKey {
  const index = FORM_IDS.findIndex(id => id === form);
  return `SurfaceForm${FORM_NAMES[index < 0 ? 8 : index]}${suffix}` as LocaleKey;
}

function RangeControl({
  label,
  unit = "%",
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  unit?: string;
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
      <output aria-live="polite">{value}{unit}</output>
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
          <span className="surface-settings__eyebrow">{t("SurfaceStudioEyebrow")}</span>
          <h3 className="settings-section__title">{t("SurfaceStudioHeroTitle")}</h3>
          <p className="settings-section__description">
            {t("SurfaceStudioHeroDescription")}
          </p>
        </div>
        <div className="surface-settings__preview" data-form={config.topArcForm} aria-label={`${t(formKey(config.topArcForm,"Name"))} · ${t("SurfaceStudioPreview")}`}>
          <StructurePreview form={config.topArcForm} catalog={catalog} maxWidth={144} maxHeight={80}/>
        </div>
      </header>

      <div className="surface-settings__grid">
        <div className="surface-settings__intro-controls">
        <SurfaceControl title={t("SurfaceStudioInteractions")} description={t("SurfaceStudioInteractionsHelp")}>
          <div className="surface-interactions">
            {([
              ['hoverDetails','SurfaceStudioHover','SurfaceStudioHoverHelp'],
              ['wheelCycle','SurfaceStudioWheel','SurfaceStudioWheelHelp'],
              ['autoFold','SurfaceStudioFold','SurfaceStudioFoldHelp'],
            ] as const).map(([key,label,helper])=>{
              return <div className="surface-interaction" data-disabled={false} key={key}>
                <span><strong>{t(label)}</strong><small>{t(helper)}</small></span>
                <Toggle ariaLabel={t(label)} disabled={false} checked={normalizeSurfaceInteractions(config.interactions)[key]} onChange={checked=>patch({interactions:{...normalizeSurfaceInteractions(config.interactions),[key]:checked}})}/>
              </div>;
            })}
            <label className="surface-interaction surface-interaction--number">
              <span><strong>{t("SurfaceStudioFoldDelay")}</strong><small>{t("SurfaceStudioFoldDelayHelp")}</small></span>
              <span className="surface-number"><input aria-label={t("SurfaceStudioFoldDelayMs")} type="number" min={100} max={3000} step={100} disabled={!normalizeSurfaceInteractions(config.interactions).autoFold} value={normalizeSurfaceInteractions(config.interactions).foldDelayMs} onChange={e=>patch({interactions:normalizeSurfaceInteractions({...config.interactions,foldDelayMs:Number(e.target.value)})})}/><small>ms</small></span>
            </label>
          </div>
        </SurfaceControl>
        <SurfaceControl title={t("SurfaceStudioDemo")} description={t("SurfaceStudioDemoHelp")}>
          <div className="surface-demo-action">
          <Toggle checked={demo.enabled} ariaLabel={t("SurfaceStudioDemoToggle")} disabled={false} onChange={value => { void demo.toggle(value); }} />
          <button type="button" onClick={() => {
            patch({ topArcEnabled: true, topArcForm: "seam", topArcAnchor: "right" });
            void demo.toggle(true);
          }}><span>{t("SurfaceStudioPreviewSeam")}</span><small>{t("SurfaceStudioSixSamples")}</small></button>
          </div>
          {demo.error && <p role="alert">{demo.error}</p>}
        </SurfaceControl>
        </div>
        <div className="surface-settings__column">
          <SurfaceControl title={t("SurfaceStudioShow")} description={t("SurfaceStudioShowHelp")}>
          <Toggle
            checked={config.topArcEnabled}
            ariaLabel={t("SurfaceStudioShowToggle")}
            disabled={false}
            onChange={(topArcEnabled) => patch({ topArcEnabled })}
          />
          </SurfaceControl>
          <SurfaceControl title={t("SurfaceStudioOpacity")}>
          <RangeControl label={t("SurfaceStudioOpacity")} value={config.topArcOpacity} min={30} max={100} step={5} disabled={!config.topArcEnabled} onChange={(topArcOpacity) => patch({ topArcOpacity })} />
          </SurfaceControl>
          <SurfaceControl title={`${t("SurfaceStudioSize")} · ${config.topArcScale}%`} description={t("SurfaceStudioSizeHelp")}>
          <div>
          <div className="surface-size-presets" role="group" aria-label={t("SurfaceStudioSizePresets")}>
            {([{key:"SurfaceStudioSmall",value:75},{key:"SurfaceStudioDefault",value:100},{key:"SurfaceStudioLarge",value:125}] as const).map(preset =>
              <button key={preset.value} type="button" disabled={!config.topArcEnabled} aria-pressed={config.topArcScale===preset.value}
                onClick={()=>patch({topArcScale:preset.value})}>{t(preset.key)} · {preset.value}%</button>)}
          </div>
          <RangeControl label={t("SurfaceStudioScale")} value={config.topArcScale} min={75} max={125} step={5} disabled={!config.topArcEnabled} onChange={(topArcScale) => patch({ topArcScale })} />
          </div>
          </SurfaceControl>
        </div>

        <div className="surface-settings__column surface-settings__column--behavior">
          <SurfaceControl title={t("SurfaceStudioAutoHide")} description={t("SurfaceStudioAutoHideHelp")}>
          <Toggle checked={config.topArcAutoHide} ariaLabel={t("SurfaceStudioAutoHideToggle")} disabled={!config.topArcEnabled} onChange={(topArcAutoHide) => patch({ topArcAutoHide })} />
          </SurfaceControl>
          <SurfaceControl title={t("SurfaceStudioHideDelay")} description={t("SurfaceStudioHideDelayHelp")}>
          <RangeControl label={t("SurfaceStudioHideDelay")} unit=" ms" value={config.topArcAutoHideDelayMs} min={300} max={3000} step={100} disabled={!config.topArcEnabled || !config.topArcAutoHide} onChange={(topArcAutoHideDelayMs) => patch({ topArcAutoHideDelayMs })} />
          </SurfaceControl>
          <SurfaceControl title={t("SurfaceStudioClickThrough")} description={t("SurfaceStudioClickThroughHelp")}>
          <Toggle checked={config.topArcClickThrough} ariaLabel={t("SurfaceStudioClickThroughToggle")} disabled={!config.topArcEnabled} onChange={(topArcClickThrough) => patch({ topArcClickThrough })} />
          </SurfaceControl>
          <SurfaceControl title={t("SurfaceStudioFullscreen")} description={t("SurfaceStudioFullscreenHelp")}>
          <Toggle checked={config.topArcHideFullscreen} ariaLabel={t("SurfaceStudioFullscreenToggle")} disabled={!config.topArcEnabled} onChange={(topArcHideFullscreen) => patch({ topArcHideFullscreen })} />
          </SurfaceControl>
        </div>

        <div className="surface-settings__column surface-settings__column--catalog">
          <fieldset className="surface-structure-picker" disabled={!config.topArcEnabled}>
            <legend>{t("SurfaceStudioStructure")}</legend>
            <div className="surface-structure-picker__meta">
              <p>{t("SurfaceStudioStructureHelp")}</p>
              <output>{FLOW_SURFACE_FORM_CATALOG.length} {t("SurfaceStudioStructures")}</output>
            </div>
            <div className="surface-structure-picker__choices">
              {FLOW_SURFACE_FORM_CATALOG.map(({ id: form }) => (
                <article
                  key={form}
                  className="surface-structure-choice"
                  data-form={form}
                  data-selected={config.topArcForm === form}
                >
                  <StructurePreview form={form} catalog={catalog} showDimensions/>
                  <button type="button" aria-pressed={config.topArcForm===form}
                    onClick={()=>patch({topArcForm:form,topArcAnchor:flowSurfaceDefaultAnchor(form)})}>
                  <span className="surface-structure-choice__title"><strong>{t(formKey(form,"Name"))}</strong>{config.topArcForm===form&&<span>{t("SurfaceStudioSelected")}</span>}</span>
                  <small>{t(formKey(form,"Description"))}</small>
                  </button>
                </article>
              ))}
            </div>
          </fieldset>
          <div className="surface-settings__docking-row">
          <SurfaceControl title={t("SurfaceStudioPosition")} description={t("SurfaceStudioPositionHelp")}>
          <Select
            value={config.topArcAnchor}
            disabled={!config.topArcEnabled}
            ariaLabel={t("SurfaceStudioPositionToggle")}
            onChange={(value) => patch({ topArcAnchor: value as SurfaceSettings["topArcAnchor"] })}
            options={flowSurfaceAnchorOptions(config.topArcForm).map((anchor) => ({
              value: anchor,
              label: t(ANCHOR_KEYS[anchor]),
            }))}
          />
          </SurfaceControl>
          <SurfaceControl title={t("SurfaceStudioRestore")} description={t("SurfaceStudioRestoreHelp")}>
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
            {t("SurfaceStudioRestoreButton")}
          </button>
          </SurfaceControl>
          </div>
        </div>
      </div>
      <p className="settings-section__hint">
        {t("SurfaceStudioHint")}
      </p>
    </section>
  );
}
