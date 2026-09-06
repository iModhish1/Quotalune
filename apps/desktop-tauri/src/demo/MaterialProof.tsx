import {useState} from "react";

import {ALL_FLOW_SURFACE_ANCHORS,FLOW_SURFACE_FORM_CATALOG,type FlowSurfaceAnchor,type FlowSurfaceForm} from "../design-system/flowSurface";
import {THEME_CATALOG} from "../design-system/themeCatalog";
import {catalogMotion} from "../design-system/themeMotion";
import StructurePreview from "../surfaces/settings/StructurePreview";
import "./MaterialProof.css";

export function proofFormFromSearch(search:string):FlowSurfaceForm{
  const requested=new URLSearchParams(search).get("form");
  return FLOW_SURFACE_FORM_CATALOG.some(form=>form.id===requested)
    ? requested as FlowSurfaceForm
    : "lens";
}

export function proofAnchorFromSearch(search:string):FlowSurfaceAnchor{
  const requested=new URLSearchParams(search).get("anchor");
  return ALL_FLOW_SURFACE_ANCHORS.includes(requested as FlowSurfaceAnchor)
    ? requested as FlowSurfaceAnchor
    : "right";
}

export function proofIdentityFromSearch(search:string):string|null{
  const requested=new URLSearchParams(search).get("inspect");
  return THEME_CATALOG.some(theme=>theme.slug===requested) ? requested : null;
}

/** Browser-only visual evidence; it never persists native settings. */
export default function MaterialProof(){
  const [form,setForm]=useState<FlowSurfaceForm>(()=>proofFormFromSearch(location.search));
  const [anchor,setAnchor]=useState<FlowSurfaceAnchor>(()=>proofAnchorFromSearch(location.search));
  const [appTheme,setAppTheme]=useState<"dark"|"light">(()=>new URLSearchParams(location.search).get("theme")==="light"?"light":"dark");
  const [expanded,setExpanded]=useState<string|null>(()=>proofIdentityFromSearch(location.search));
  return <div data-theme={appTheme} className="material-proof-shell">
    <main className="material-proof">
      <header className="material-proof__hero">
        <div><span>IDENTITY LAB</span><h1>Nine complete surface identities</h1><p>One real structure, nine distinct finishes, frames, meters, marks and motion signatures. Synthetic quota data only.</p></div>
        <div className="material-proof__controls">
          <label>Structure<select aria-label="Proof structure" value={form} onChange={event=>setForm(event.target.value as FlowSurfaceForm)}>{FLOW_SURFACE_FORM_CATALOG.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Anchor<select aria-label="Proof anchor" value={anchor} onChange={event=>setAnchor(event.target.value as FlowSurfaceAnchor)}>{ALL_FLOW_SURFACE_ANCHORS.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
          <label>App theme<select aria-label="Proof app theme" value={appTheme} onChange={event=>setAppTheme(event.target.value as "dark"|"light")}><option value="dark">Dark</option><option value="light">Light</option></select></label>
        </div>
      </header>
      <section className="material-proof__grid" aria-label="Theme identity comparison">
        {THEME_CATALOG.map(theme=>{
          const motion=catalogMotion(theme);
          return <article key={theme.slug} className="material-proof__card"
            onMouseEnter={()=>setExpanded(theme.slug)} onMouseLeave={()=>setExpanded(null)}
            onFocus={()=>setExpanded(theme.slug)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setExpanded(null);}}>
            <div className="material-proof__stage"><StructurePreview form={form} anchor={anchor} catalog={theme.slug} expanded={expanded===theme.slug} maxWidth={300} maxHeight={176}/></div>
            <div className="material-proof__identity"><div><h2>{theme.name}</h2><p>{theme.identity?.signature}</p></div><span>{motion.character}</span></div>
            <dl><div><dt>Frame</dt><dd>{theme.identity?.edgeStyle} · {theme.identity?.detailRadius}px</dd></div><div><dt>Meter</dt><dd>{theme.identity?.meterCap}</dd></div><div><dt>Motion</dt><dd>{motion.durationMs}ms</dd></div></dl>
            <button className="material-proof__inspect" type="button">Hold to inspect</button>
          </article>;
        })}
      </section>
    </main>
  </div>;
}
