import { useEffect, useRef, useState } from "react";
import { placeSurface, snapSurface, SURFACE_POSITIONS } from "../design-system/surfacePlacement";
import FlowSurface from "../surfaces/flow-surface/FlowSurface";
import { SURFACE_DEMO_PROVIDERS } from "../lib/surfaceDemo";
import { reelBaseSize } from "../surfaces/reel/reelGeometry";
import {FLOW_SURFACE_FORM_CATALOG,flowSurfaceEnvelope,type FlowSurfaceAnchor, type FlowSurfaceState } from "../design-system/flowSurface";
import type { FlowSurfaceForm } from "../design-system/flowSurface";
import {DEFAULT_SURFACE_INTERACTIONS,normalizeSurfaceInteractions} from "../design-system/surfaceInteractions";
import {THEME_CATALOG} from "../design-system/themeCatalog";

export default function ReelPreview() {
  const params = new URLSearchParams(location.search);
  const [anchor, setAnchor] = useState<FlowSurfaceAnchor>(params.get("anchor") as FlowSurfaceAnchor || "right");
  const requestedState=params.get("state");
  const [state, setState] = useState<FlowSurfaceState>(requestedState === "expanded"||requestedState==="hidden" ? requestedState : "compact");
  const [focus, setFocus] = useState(0);
  const [interactions,setInteractions]=useState(DEFAULT_SURFACE_INTERACTIONS);
  const requestedForm=params.get("form") as FlowSurfaceForm;
  const [form,setForm] = useState<FlowSurfaceForm>(FLOW_SURFACE_FORM_CATALOG.some(entry=>entry.id===requestedForm) ? requestedForm : "seam");
  const requestedCatalog=params.get('catalog');
  const catalog=THEME_CATALOG.some(theme=>theme.slug===requestedCatalog)?requestedCatalog!:THEME_CATALOG[0].slug;
  const size = form==='reel' ? reelBaseSize(state, anchor === "top" || anchor === "bottom") : flowSurfaceEnvelope(form,state,100,6,anchor);
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
    <h1 style={{ fontSize: 18,margin:0 }}>QuotaArc · Structure Studio</h1><p style={{fontSize:11}}>Actual-size components · six synthetic providers</p>
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
    <div ref={canvas} style={{position:"absolute",inset:"190px 0 0",overflow:"hidden"}}>
    <div onPointerDown={e=>{if(e.button!==0 || !(e.target as HTMLElement).closest('[aria-label="Move Quotalis"]'))return;
      drag.current={x:e.clientX,y:e.clientY,left:position.x,top:position.y};e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{if(!drag.current)return;setAnchor("free");setFree({x:Math.max(0,Math.min(area.width-width,drag.current.left+e.clientX-drag.current.x)),y:Math.max(0,Math.min(area.height-height,drag.current.top+e.clientY-drag.current.y))});}}
      onPointerUp={e=>{if(!drag.current)return;drag.current=undefined;setAnchor(snapSurface(position.x,position.y,width,height,area.width,area.height));e.currentTarget.releasePointerCapture(e.pointerId);}}
      onPointerCancel={()=>{drag.current=undefined;}}
      style={{ position: "absolute", left:position.x,top:position.y,width,height,touchAction:"none" }}>
      <FlowSurface catalog={catalog} settings={{form,anchor,scale:100,autoHide:true,autoHideDelayMs:900,interactions}}
        state={state} providers={SURFACE_DEMO_PROVIDERS} demoMode focusedIndex={focus} onFocusProvider={setFocus}
        onReveal={() => setState("compact")} onToggleExpanded={() => setState(state === "expanded" ? "compact" : "expanded")}
        onRequestCompact={() => {if(!drag.current)setState("compact");}} onTogglePinned={() => setState(state === "pinned" ? "expanded" : "pinned")} />
    </div>
    </div>
  </main>;
}
