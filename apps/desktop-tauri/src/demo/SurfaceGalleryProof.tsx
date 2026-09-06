import {useState} from "react";

import {FLOW_SURFACE_FORM_CATALOG,flowSurfaceDefaultAnchor,type FlowSurfaceForm} from "../design-system/flowSurface";
import {THEME_CATALOG} from "../design-system/themeCatalog";
import StructurePreview from "../surfaces/settings/StructurePreview";
import SettingsShellHeader from "../surfaces/settings/SettingsShellHeader";
import "../surfaces/settings/SettingsStudio.css";

/** Browser-safe proof of the production structure gallery and its real renderers. */
export default function SurfaceGalleryProof(){
  const query=new URLSearchParams(location.search);
  const requestedForm=query.get('form');
  const requestedCatalog=query.get('catalog');
  const [selected,setSelected]=useState<FlowSurfaceForm>(()=>FLOW_SURFACE_FORM_CATALOG.some(entry=>entry.id===requestedForm)?requestedForm as FlowSurfaceForm:"satellite");
  const [catalog,setCatalog]=useState(()=>THEME_CATALOG.some(theme=>theme.slug===requestedCatalog)?requestedCatalog!:THEME_CATALOG[0].slug);
  const [theme,setTheme]=useState<"dark"|"light">(()=>new URLSearchParams(location.search).get("theme")==="light"?"light":"dark");
  return <div data-theme={theme}>
    <main className="settings settings-studio" data-navigation="sidebar">
      <SettingsShellHeader section="Surfaces"/>
      <nav className="settings-tabs" aria-label="Preview navigation">
        {['General','Providers','Notifications','Menu Bar','Usage','Surfaces','Themes','About'].map(label=><button type="button" key={label} className={`settings-tab ${label==='Surfaces'?'settings-tab--active':''}`}><span className="settings-tab__icon" aria-hidden>{label[0]}</span><span className="settings-tab__label">{label}</span></button>)}
      </nav>
      <div className="settings-body">
        <section className="settings-section surface-settings">
          <header className="surface-settings__hero"><div><span className="surface-settings__eyebrow">SURFACE STUDIO</span><h2 className="settings-section__title">Distinct structures, truthful footprints</h2><p className="settings-section__description">Real compact renderers using the selected identity. No placeholder silhouettes.</p></div><div className="surface-gallery-proof__filters"><select aria-label="Preview app theme" value={theme} onChange={event=>setTheme(event.target.value as "dark"|"light")}><option value="dark">Dark app</option><option value="light">Light app</option></select><select aria-label="Preview identity" value={catalog} onChange={event=>setCatalog(event.target.value)}>{THEME_CATALOG.map(theme=><option key={theme.slug} value={theme.slug}>{theme.name}</option>)}</select></div></header>
          <div className="surface-settings__grid">
            <div className="surface-settings__column surface-settings__column--catalog">
              <fieldset className="surface-structure-picker"><legend>Structure</legend><div className="surface-structure-picker__meta"><p>Choose a distinct silhouette. Every card is rendered by the real surface component with the active identity.</p><output>{FLOW_SURFACE_FORM_CATALOG.length} structures</output></div>
                <div className="surface-structure-picker__choices">{FLOW_SURFACE_FORM_CATALOG.map(({id,name,description})=><article key={id} className="surface-structure-choice" data-selected={selected===id}><StructurePreview form={id} catalog={catalog} showDimensions/><button type="button" aria-pressed={selected===id} onClick={()=>setSelected(id)}><span className="surface-structure-choice__title"><strong>{name}</strong>{selected===id&&<span>Selected</span>}</span><small>{description}</small></button></article>)}</div>
              </fieldset>
              <div className="surface-settings__docking-row"><section className="surface-control"><div className="surface-control__copy"><strong>Position</strong><small>Default anchor for the selected structure.</small></div><output>{flowSurfaceDefaultAnchor(selected)}</output></section><section className="surface-control"><div className="surface-control__copy"><strong>Live footprint</strong><small>Dimensions are shown on every card before selection.</small></div></section></div>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>;
}
