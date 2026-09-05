import { useState } from "react";
import FlowSurface from "../surfaces/flow-surface/FlowSurface";
import { SURFACE_DEMO_PROVIDERS } from "../lib/surfaceDemo";
import { reelBaseSize } from "../surfaces/reel/reelGeometry";
import type { FlowSurfaceAnchor, FlowSurfaceState } from "../design-system/flowSurface";
import { isNotchForm, notchLayout } from "../surfaces/notch/notchGeometry";
import type { FlowSurfaceForm } from "../design-system/flowSurface";

export default function ReelPreview() {
  const params = new URLSearchParams(location.search);
  const [anchor, setAnchor] = useState<FlowSurfaceAnchor>(params.get("anchor") as FlowSurfaceAnchor || "right");
  const [state, setState] = useState<FlowSurfaceState>(params.get("state") === "expanded" ? "expanded" : "compact");
  const [focus, setFocus] = useState(0);
  const [form,setForm] = useState<FlowSurfaceForm>(isNotchForm(params.get("form") ?? "") ? params.get("form") as FlowSurfaceForm : "seam");
  const size = isNotchForm(form) ? notchLayout(form,state,anchor,6) : reelBaseSize(state, anchor === "top" || anchor === "bottom");
  return <main style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at 15% 85%,#dfb8a0,transparent 60%),radial-gradient(ellipse at 85% 15%,#a6c7cb,transparent 65%),#e2deda", color: "#202427", padding: 20 }}>
    <h1 style={{ fontSize: 18,margin:0 }}>QuotaArc · Structure Studio</h1><p style={{fontSize:11}}>Actual-size components · six synthetic providers</p>
    <label>Structure <select aria-label="Preview structure" value={form} onChange={e=>{setForm(e.target.value as FlowSurfaceForm);setFocus(0);}}>
      {["seam","ribbon","cradle","deck","satellite","reel"].map(f=><option key={f}>{f}</option>)}</select></label><br/>
    <label>Position <select aria-label="Preview position" value={anchor} onChange={e => setAnchor(e.target.value as FlowSurfaceAnchor)}>
      {["right", "left", "top", "bottom", "top-right", "bottom-left", "free"].map(a => <option key={a}>{a}</option>)}
    </select></label>
    <button onClick={() => setState(state === "hidden" ? "compact" : "hidden")}>Hide / reveal</button>
    <div style={{ position: "absolute", right: anchor.includes("left")?undefined:0, left:anchor.includes("left")?0:undefined, top: "50%", transform: "translateY(-50%)", width:`min(100%, ${size.width}px)`,aspectRatio:`${size.width}/${size.height}` }}>
      <FlowSurface catalog="01-obsidian-orbit" settings={{form,anchor,scale:100,autoHide:true,autoHideDelayMs:900}}
        state={state} providers={SURFACE_DEMO_PROVIDERS} demoMode focusedIndex={focus} onFocusProvider={setFocus}
        onReveal={() => setState("compact")} onToggleExpanded={() => setState(state === "expanded" ? "compact" : "expanded")}
        onRequestCompact={() => setState("compact")} onTogglePinned={() => setState(state === "pinned" ? "expanded" : "pinned")} />
    </div>
  </main>;
}
