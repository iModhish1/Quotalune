import {useSettingsCopy} from "../useSettingsCopy";
import {useEffect,useState} from "react";
import {listen} from "@tauri-apps/api/event";
import FlowSurface from "../../flow-surface/FlowSurface";
import { CATALOG_STAGE_FIXTURE } from "../../../components/orbit/stageFixture";
import { CANONICAL_THEME, THEME_CATALOG, catalogBySlug } from "../../../design-system/themeCatalog";
import {getSettingsSnapshot,setCatalogTheme,type CatalogThemeScope} from "../../../lib/tauri";
import {resolveCatalogTheme,type CatalogThemeSettings,type CatalogSurfaceId} from "../../../design-system/themeResolution";
import "./ThemeGallery.css";
import StructurePreview from "../StructurePreview";
import {FLOW_SURFACE_FORM_CATALOG,type FlowSurfaceForm} from "../../../design-system/flowSurface";
import {catalogMotion} from "../../../design-system/themeMotion";
import {Select} from "../../../components/FormControls";

export default function ThemeGallery() {
  const tr = useSettingsCopy();
  const [snapshot,setSnapshot]=useState<CatalogThemeSettings>({});
  const [previewForm,setPreviewForm]=useState<FlowSurfaceForm>('lens');
  const [previewExpanded,setPreviewExpanded]=useState<string|null>(null);
  const [scope,setScope]=useState<CatalogThemeScope>('global');
  const surface=scope.startsWith('surface:')?scope.slice(8) as CatalogSurfaceId:undefined;
  const resolved=resolveCatalogTheme(scope==='global'?{catalogTheme:snapshot.catalogTheme}:scope==='profile'?{...snapshot,surfaceCatalogThemes:{}}:snapshot,surface??'top');
  const active=resolved.slug;
  const hasOverride=scope==='profile'?!!snapshot.activeProfileCatalogTheme:surface?!!snapshot.surfaceCatalogThemes?.[surface]:false;
  const [ready,setReady]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string>();
  useEffect(()=>{
    let alive=true;
    const load=()=>getSettingsSnapshot().then(s=>{if(alive){setSnapshot(s);setReady(true);}}).catch(e=>{if(alive)setError(String(e));});
    void load();
    const subscription=listen("quotalis:settings-updated",()=>{void load();}).catch(()=>()=>{});
    return()=>{alive=false;void subscription.then(stop=>stop());};
  },[]);
  async function apply(slug:string){
    setSaving(true);setError(undefined);
    try{
      await setCatalogTheme(slug,scope);
      setSnapshot(previous=>scope==='global'?{...previous,catalogTheme:slug}:scope==='profile'?{...previous,activeProfileCatalogTheme:slug||null}:{...previous,surfaceCatalogThemes:{...previous.surfaceCatalogThemes,[surface!]:slug}});
    }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setSaving(false);}
  }
  return (
    <section className="settings-section theme-gallery">
      <div className="theme-gallery__heading">
        <div>
          <h3 className="settings-section__title">{tr("Surface identities")}</h3>
          <p className="settings-section__description">
            {tr("Change the complete visual identity—finish, rim, icon frame, typography and depth—without changing placement or quota data.")}
          </p>
        </div>
        <div className="theme-gallery__provenance" data-source={resolved.source}>
          <span>{tr("Effective source")}: {tr(resolved.source === "global" ? "Global" : resolved.source === "profile" ? "Current profile" : resolved.source)}</span>
          <strong>{catalogBySlug(active)?.name}</strong>
        </div>
      </div>
      <div className="theme-gallery__assignment">
        <label>{tr("Apply theme to")}
          <Select ariaLabel={tr("Theme assignment")} value={scope} disabled={saving||!ready} onChange={value=>setScope(value as CatalogThemeScope)}
            options={[
              {value:"global",label:tr("Global default")},
              {value:"profile",label:tr("Current profile")},
              ...(['taskbar','top','edge','hud','quick','dashboard'] as const).map(id=>({value:`surface:${id}`,label:`${id} surface`})),
            ]}/>
        </label>
        {scope!=='global' && <button type="button" disabled={!ready||saving||!hasOverride} onClick={()=>void apply('')}>{tr("Use inherited theme")}</button>}
        <p>{tr("Surface overrides profile; profile overrides global. Provider brand colors remain independent from the selected theme.")}</p>
      </div>
      {error && <p role="alert" className="theme-gallery__error">{error}</p>}
      <div className="theme-gallery__preview-controls">
        <label>{tr("Preview structure")} <Select ariaLabel={tr("Theme preview structure")} value={previewForm} onChange={value=>setPreviewForm(value as FlowSurfaceForm)}
          options={FLOW_SURFACE_FORM_CATALOG.map(form=>({value:form.id,label:form.name}))}/></label>
        <p>{tr("Hover or focus a card to reveal details. This preview does not change your desktop structure.")}</p>
      </div>
      <div className="theme-gallery__grid">
        {THEME_CATALOG.map(theme=><article key={theme.slug} className="theme-gallery__tile" data-active={active===theme.slug}
          onMouseEnter={()=>setPreviewExpanded(theme.slug)} onMouseLeave={()=>setPreviewExpanded(null)}
          onFocus={()=>setPreviewExpanded(theme.slug)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setPreviewExpanded(null);}}>
          <div className="theme-gallery__material-preview">
            <StructurePreview form={previewForm} catalog={theme.slug} expanded={previewExpanded===theme.slug} maxWidth={240} maxHeight={150}/>
          </div>
          <div className="theme-gallery__tile-label"><span><strong>{theme.name}</strong><small>{theme.identity?.signature} · {catalogMotion(theme).character} motion</small></span>
            <span className="theme-gallery__swatches" aria-hidden="true"><i style={{background:theme.accent}}/><i style={{background:theme.accent2}}/><i style={{background:theme.accent3}}/></span>
          </div>
          <dl className="theme-gallery__facets">
            <div><dt>{tr("Frame")}</dt><dd>{theme.identity?.edgeStyle} · {theme.identity?.detailRadius}px</dd></div>
            <div><dt>{tr("Meter")}</dt><dd>{theme.identity?.meterCap}</dd></div>
            <div><dt>{tr("Motion")}</dt><dd>{theme.expansionMs}ms</dd></div>
          </dl>
          <button type="button" aria-label={`Apply ${theme.name}`} aria-pressed={active===theme.slug} disabled={!ready||saving} onClick={()=>void apply(theme.slug)}>{tr(active===theme.slug?"Selected":"Apply theme")}</button>
        </article>)}
      </div>
    </section>
  );
}
