import { useState } from "react";
import FlowSurface from "../surfaces/flow-surface/FlowSurface";
import { SURFACE_DEMO_PROVIDERS } from "../lib/surfaceDemo";
import { reelBaseSize } from "../surfaces/reel/reelGeometry";
import type { FlowSurfaceAnchor, FlowSurfaceState } from "../design-system/flowSurface";

export default function ReelPreview() {
  const params = new URLSearchParams(location.search);
  const [anchor, setAnchor] = useState<FlowSurfaceAnchor>(params.get("anchor") as FlowSurfaceAnchor || "right");
  const [state, setState] = useState<FlowSurfaceState>(params.get("state") === "expanded" ? "expanded" : "compact");
  const [focus, setFocus] = useState(0);
  const size = reelBaseSize(state, anchor === "top" || anchor === "bottom");
  return <main style={{ position: "fixed", inset: 0, background: "#1d2025", color: "#dbe0e7", padding: 24 }}>
    <h1 style={{ fontSize: 20 }}>Orbit Reel</h1><p>Six synthetic providers · scroll the selector or use arrow keys.</p>
    <label>Position <select aria-label="Preview position" value={anchor} onChange={e => setAnchor(e.target.value as FlowSurfaceAnchor)}>
      {["right", "left", "top", "bottom", "top-right", "bottom-left", "free"].map(a => <option key={a}>{a}</option>)}
    </select></label>
    <button onClick={() => setState(state === "hidden" ? "compact" : "hidden")}>Hide / reveal</button>
    <div style={{ position: "absolute", right: 24, top: "50%", transform: "translateY(-50%)", ...size }}>
      <FlowSurface catalog="01-obsidian-orbit" settings={{form:"reel",anchor,scale:100,autoHide:true,autoHideDelayMs:900}}
        state={state} providers={SURFACE_DEMO_PROVIDERS} demoMode focusedIndex={focus} onFocusProvider={setFocus}
        onReveal={() => setState("compact")} onToggleExpanded={() => setState(state === "expanded" ? "compact" : "expanded")}
        onRequestCompact={() => setState("compact")} onTogglePinned={() => setState(state === "pinned" ? "expanded" : "pinned")} />
    </div>
  </main>;
}
