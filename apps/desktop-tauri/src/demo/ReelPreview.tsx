import { useEffect, useRef, useState } from "react";
import { placeSurface, snapSurface, SURFACE_POSITIONS } from "../design-system/surfacePlacement";
import FlowSurface from "../surfaces/flow-surface/FlowSurface";
import { buildStructureQaProviders } from "../lib/structureFixtures";
import { reelBaseSize } from "../surfaces/reel/reelGeometry";
import {FLOW_SURFACE_FORM_CATALOG,flowSurfaceEnvelope,type FlowSurfaceAnchor, type FlowSurfaceState } from "../design-system/flowSurface";
import type { FlowSurfaceForm } from "../design-system/flowSurface";
import {DEFAULT_SURFACE_INTERACTIONS,normalizeSurfaceInteractions} from "../design-system/surfaceInteractions";
import {THEME_CATALOG} from "../design-system/themeCatalog";

/**
 * Wave 1E §22-26: this file (name unchanged to avoid breaking existing
 * `?gen=reel` references, but its actual scope is every one of the 14
 * forms) IS the Dev-only structure QA fixture panel — reachable only via
 * the pre-existing `?window=demo&gen=reel` proof-harness route (see
 * `DemoStage.tsx`'s own doc comment: "Runs in a plain browser (no Tauri
 * APIs)"), never through real app navigation, and structurally incapable
 * of reaching Personal (no Tauri IPC exists in this route at all — see
 * `docs/validation/WAVE1_NATIVE_QA_HANDOFF.md`). It already drove the
 * REAL production `FlowSurface` component (which internally dispatches to
 * the real `ReelSurface`/`NotchSurface` too) with a structure/anchor/
 * state/interactions selector; Wave 1E added provider count, name/reset
 * length, usage windows, data state, a pin toggle and an RTL layout-
 * direction toggle. Wave 1F extended data state with `error`/`timeout`
 * once `StageProvider.status` gained real, non-fabricated values for
 * both (see `stageProviders.ts`'s `toStageProviders()` and
 * `structureFixtures.ts`'s `syntheticErrorProvider()`/
 * `syntheticTimeoutProvider()`) — `zero` is deliberately NOT a distinct
 * data-state option here: a real zero-usage provider is just
 * `primaryValue: 0` with `status: "ok"`, which every "available" fixture
 * can already represent by construction, not a separate case to fake.
 *
 * Two dimensions §23 also lists are NOT added here, for real, checked
 * reasons rather than an oversight:
 * - **Real Arabic text / language switching**: this route's
 *   `PreviewLocaleProvider` (`i18n/LocaleProvider.tsx`) is a stub —
 *   `language` is hardcoded to `"english"`, `setLanguage` is a no-op, and
 *   there is no Tauri IPC here to fetch real `ar-SA.ftl` translations.
 *   The RTL toggle below sets `dir="rtl"` directly (a real, useful CSS
 *   bidi-layout test) but cannot show real Arabic strings — only a live
 *   Tauri session can (see the handoff doc).
 * - **Light/Dark app color mode**: `FlowSurface.css` styles every form
 *   with fixed dark colors (`#f4f6f9` etc.), not `prefers-color-scheme`/
 *   a `data-theme` attribute — Structures do not currently have a
 *   distinct Light-mode palette separate from their Structure Theme
 *   (catalog). Adding a fake toggle that changes nothing real would be
 *   worse than not adding one; this is a real product question for the
 *   native session, not a gap in this panel.
 */
export default function ReelPreview() {
  const params = new URLSearchParams(location.search);
  const [anchor, setAnchor] = useState<FlowSurfaceAnchor>(params.get("anchor") as FlowSurfaceAnchor || "right");
  const requestedState=params.get("state");
  const [state, setState] = useState<FlowSurfaceState>(requestedState === "expanded"||requestedState==="hidden"||requestedState==="pinned" ? requestedState : "compact");
  const [focus, setFocus] = useState(0);
  const [interactions,setInteractions]=useState(DEFAULT_SURFACE_INTERACTIONS);
  const requestedForm=params.get("form") as FlowSurfaceForm;
  const [form,setForm] = useState<FlowSurfaceForm>(FLOW_SURFACE_FORM_CATALOG.some(entry=>entry.id===requestedForm) ? requestedForm : "seam");
  const requestedCatalog=params.get('catalog');
  const catalog=THEME_CATALOG.some(theme=>theme.slug===requestedCatalog)?requestedCatalog!:THEME_CATALOG[0].slug;

  // Wave 1E §23 fixture controls.
  const [providerCount, setProviderCount] = useState(Number(params.get("count") ?? "6"));
  const [nameLength, setNameLength] = useState<"normal" | "long">((params.get("name") as "long") ?? "normal");
  const [resetLength, setResetLength] = useState<"normal" | "long" | "unavailable">((params.get("reset") as "long" | "unavailable") ?? "normal");
  const [windows, setWindows] = useState<"1" | "2">((params.get("windows") as "2") ?? "1");
  const [dataState, setDataState] = useState<"available" | "loading" | "refreshing" | "unavailable" | "error" | "timeout">(
    (params.get("data") as "loading" | "refreshing" | "unavailable" | "error" | "timeout") ?? "available",
  );
  const [rtl, setRtl] = useState(params.get("rtl") === "1");
  useEffect(() => {
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    return () => { document.documentElement.dir = "ltr"; };
  }, [rtl]);

  // Wave 1F: shared with the native-lane Dev QA controller
  // (hooks/useStructureQaFixture.ts / TopArc.tsx) via
  // buildStructureQaProviders(), so the two panels can never render
  // different providers for what looks like the same selection.
  const providers = buildStructureQaProviders({
    providerCount, nameLength, resetLength, dataState,
    windows: windows === "2" ? 2 : 1,
  });
  const initialLoading = dataState === "loading";
  const isRefreshing = dataState === "refreshing";

  const size = form==='reel' ? reelBaseSize(state, anchor === "top" || anchor === "bottom") : flowSurfaceEnvelope(form,state,100,providers.length,anchor);
  const canvas=useRef<HTMLDivElement>(null);
  const drag=useRef<{x:number;y:number;left:number;top:number}>();
  const [area,setArea]=useState({width:360,height:440});
  const [free,setFree]=useState({x:60,y:100});
  const factor=Math.min(1,area.width/size.width,area.height/size.height);
  const width=size.width*factor,height=size.height*factor;
  const positioned=anchor==="free"?free:placeSurface(anchor,width,height,area.width,area.height);
  const position={x:Math.max(0,Math.min(positioned.x,area.width-width)),y:Math.max(0,Math.min(positioned.y,area.height-height))};
  useEffect(()=>{if(!canvas.current)return;const observer=new ResizeObserver(([entry])=>setArea({width:entry.contentRect.width,height:entry.contentRect.height}));observer.observe(canvas.current);return()=>observer.disconnect();},[]);
  return <main style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 15% 85%,#dfb8a0,transparent 60%),radial-gradient(ellipse at 85% 15%,#a6c7cb,transparent 65%),#e2deda", color: "#202427", padding: 20 }}>
    <h1 style={{ fontSize: 18,margin:0 }}>Quotalune · Structure Studio</h1><p style={{fontSize:11}}>Dev-only fixture QA panel (Wave 1E §22-26) · real production FlowSurface/Reel/Notch components, synthetic data only</p>
    <label>Structure <select aria-label="Preview structure" value={form} onChange={e=>{setForm(e.target.value as FlowSurfaceForm);setFocus(0);}}>
      {FLOW_SURFACE_FORM_CATALOG.map(({id,name})=><option key={id} value={id}>{name}</option>)}</select></label><br/>
    <label>Position <select aria-label="Preview position" value={anchor} onChange={e => setAnchor(e.target.value as FlowSurfaceAnchor)}>
      {SURFACE_POSITIONS.map(a => <option key={a}>{a}</option>)}
    </select></label>
    <button onClick={() => setState(state === "hidden" ? "compact" : "hidden")}>Hide / reveal</button>
    <div aria-label="Preview interaction options" style={{fontSize:11,display:"flex",gap:8,flexWrap:"wrap"}}>
      {([['hoverDetails','Hover details'],['wheelCycle','Wheel cycling'],['autoFold','Auto fold']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={interactions[key]} onChange={e=>setInteractions(current=>({...current,[key]:e.target.checked}))}/>{label}</label>)}
      <label>Fold ms <input type="number" min={100} max={3000} step={100} style={{width:55}} value={interactions.foldDelayMs} onChange={e=>setInteractions(current=>normalizeSurfaceInteractions({...current,foldDelayMs:Number(e.target.value)}))}/></label>
    </div>
    <div aria-label="Preview fixture options" style={{fontSize:11,display:"flex",gap:8,flexWrap:"wrap",marginTop:4}}>
      <label>Providers <select aria-label="Provider count" value={providerCount} onChange={e=>setProviderCount(Number(e.target.value))}>
        {[1,3,6,12,24,70].map(n=><option key={n} value={n}>{n}</option>)}
      </select></label>
      <label>Name <select aria-label="Provider name length" value={nameLength} onChange={e=>setNameLength(e.target.value as "normal"|"long")}>
        <option value="normal">Normal</option><option value="long">Long</option>
      </select></label>
      <label>Reset <select aria-label="Reset length" value={resetLength} onChange={e=>setResetLength(e.target.value as "normal"|"long"|"unavailable")}>
        <option value="normal">Normal</option><option value="long">Long</option><option value="unavailable">Unavailable</option>
      </select></label>
      <label>Windows <select aria-label="Quota windows" value={windows} onChange={e=>setWindows(e.target.value as "1"|"2")}>
        <option value="1">1</option><option value="2">2</option>
      </select></label>
      <label>Data <select aria-label="Data state" value={dataState} onChange={e=>setDataState(e.target.value as "available"|"loading"|"refreshing"|"unavailable"|"error"|"timeout")}>
        <option value="available">Available</option><option value="loading">Loading</option>
        <option value="refreshing">Refreshing</option><option value="unavailable">Unavailable</option>
        <option value="error">Error</option><option value="timeout">Timeout</option>
      </select></label>
      <label><input type="checkbox" checked={rtl} onChange={e=>setRtl(e.target.checked)}/> RTL layout (direction only — see file header re: real Arabic text)</label>
      <button onClick={()=>setState(state==="pinned"?"expanded":"pinned")}>{state==="pinned"?"Unpin":"Pin"}</button>
    </div>
    <div ref={canvas} style={{position:"absolute",inset:"224px 0 0",overflow:"hidden"}}>
    <div onPointerDown={e=>{if(e.button!==0 || !(e.target as HTMLElement).closest('[aria-label="Move Quotalune"]'))return;
      drag.current={x:e.clientX,y:e.clientY,left:position.x,top:position.y};e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{if(!drag.current)return;setAnchor("free");setFree({x:Math.max(0,Math.min(area.width-width,drag.current.left+e.clientX-drag.current.x)),y:Math.max(0,Math.min(area.height-height,drag.current.top+e.clientY-drag.current.y))});}}
      onPointerUp={e=>{if(!drag.current)return;drag.current=undefined;setAnchor(snapSurface(position.x,position.y,width,height,area.width,area.height));e.currentTarget.releasePointerCapture(e.pointerId);}}
      onPointerCancel={()=>{drag.current=undefined;}}
      style={{ position: "absolute", left:position.x,top:position.y,width,height,touchAction:"none" }}>
      <FlowSurface catalog={catalog} settings={{form,anchor,scale:100,autoHide:true,autoHideDelayMs:900,interactions}}
        state={state} providers={providers} initialLoading={initialLoading} isRefreshing={isRefreshing}
        demoMode focusedIndex={focus} onFocusProvider={setFocus}
        onReveal={() => setState("compact")} onToggleExpanded={() => setState(state === "expanded" ? "compact" : "expanded")}
        onRequestCompact={() => {if(!drag.current)setState("compact");}} onTogglePinned={() => setState(state === "pinned" ? "expanded" : "pinned")} />
    </div>
    </div>
  </main>;
}
