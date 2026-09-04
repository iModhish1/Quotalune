/** The legacy top-window host for the single Quota Island composition. */
import { useCallback, useEffect, useRef, useState } from "react";

import type { StageProvider } from "../../components/orbit/stageTypes";
import { useStageRuntime } from "../../hooks/useStageRuntime";
import {
  beginQuotaIslandDrag,
  resizeTopArc,
  type SurfaceWindowState,
} from "../../lib/surfaceBridge";
import QuotaIsland, { type QuotaIslandState } from "../quota-island/QuotaIsland";

const DEMO_PROVIDERS: StageProvider[] = [
  { id: "codex", name: "OpenAI", iconId: "openai", resolvedMode: "remaining", arcFraction: 0.74, primaryValue: 74, secondaryValue: 26, primaryLabel: "remaining", reset: "3h 40m", status: "ok" },
  { id: "claude", name: "Claude", iconId: "claude", resolvedMode: "remaining", arcFraction: 0.68, primaryValue: 68, secondaryValue: 32, primaryLabel: "remaining", reset: "26h", status: "ok" },
  { id: "gemini", name: "Gemini", iconId: "gemini", resolvedMode: "remaining", arcFraction: 0.55, primaryValue: 55, secondaryValue: 45, primaryLabel: "remaining", reset: "22h", status: "ok" },
  { id: "llama", name: "Meta", iconId: "llama", resolvedMode: "remaining", arcFraction: 0.6, primaryValue: 60, secondaryValue: 40, primaryLabel: "remaining", reset: "5d", status: "ok" },
  { id: "mistral", name: "Mistral", iconId: "mistral", resolvedMode: "remaining", arcFraction: 0.45, primaryValue: 45, secondaryValue: 55, primaryLabel: "remaining", reset: "1d", status: "attention" },
  { id: "deepseek", name: "DeepSeek", iconId: "deepseek", resolvedMode: "remaining", arcFraction: 0.7, primaryValue: 70, secondaryValue: 30, primaryLabel: "remaining", reset: "19h", status: "ok" },
  { id: "perplexity", name: "Perplexity", iconId: "perplexity", resolvedMode: "remaining", arcFraction: 0.5, primaryValue: 50, secondaryValue: 50, primaryLabel: "remaining", reset: "3d", status: "ok" },
];

interface TopArcProps {
  demo?: { state: "idle" | "hover" | "expanded" };
}

function initialState(demo: TopArcProps["demo"]): SurfaceWindowState {
  if (demo?.state === "expanded") return "expanded";
  if (demo?.state === "hover") return "hover";
  return "compact";
}

function nativeSizeState(state: QuotaIslandState): SurfaceWindowState {
  return state === "expanded" || state === "pinned" ? "expanded" : "compact";
}

export default function TopArc({ demo }: TopArcProps) {
  const runtime = useStageRuntime({ enabled: !demo, surface: "top" });
  const [surfaceState, setSurfaceState] = useState<QuotaIslandState>(() => initialState(demo));
  const [focus, setFocus] = useState(0);
  const nativeSizeRef = useRef<SurfaceWindowState | null>(null);
  const resizeRevisionRef = useRef(0);
  const providers = demo ? DEMO_PROVIDERS : runtime.providers;

  useEffect(() => {
    if (demo) return;
    // Hover is a CSS-only treatment and has the compact envelope. Native
    // changes happen only at the compact↔expanded boundary and the latest
    // intent wins if the user clicks/Escapes in quick succession.
    const nextSize = nativeSizeState(surfaceState);
    if (nativeSizeRef.current === nextSize) return;
    nativeSizeRef.current = nextSize;
    const revision = ++resizeRevisionRef.current;
    void resizeTopArc(nextSize, providers.length).catch(() => {
      if (revision === resizeRevisionRef.current) nativeSizeRef.current = null;
    });
  }, [demo, providers.length, surfaceState]);

  useEffect(() => {
    if (focus >= providers.length) setFocus(0);
  }, [focus, providers.length]);

  const cycle = useCallback((direction: 1 | -1) => {
    setFocus((current) => providers.length === 0 ? 0 : (current + direction + providers.length) % providers.length);
  }, [providers.length]);

  const startDrag = useCallback(() => {
    if (demo) return;
    // One native command changes the placement intent and begins the Windows
    // drag gesture together. This avoids losing a short drag behind a
    // round-trip through the WebView.
    void beginQuotaIslandDrag().catch(() => {});
  }, [demo]);

  useEffect(() => {
    if (demo) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "ArrowDown") cycle(1);
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") cycle(-1);
      if (event.key === "Escape") setSurfaceState("compact");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cycle, demo]);

  return (
    <div
      className="quota-island-host"
      onMouseEnter={() => setSurfaceState((state) => state === "compact" ? "hover" : state)}
      onMouseLeave={() => setSurfaceState((state) => state === "hover" ? "compact" : state)}
    >
      <QuotaIsland
        catalog={runtime.catalog}
        state={surfaceState}
        providers={providers}
        focusedIndex={focus}
        onFocusProvider={setFocus}
        onToggleExpanded={() => setSurfaceState((state) => state === "expanded" || state === "pinned" ? "compact" : "expanded")}
        onTogglePinned={() => setSurfaceState((state) => state === "pinned" ? "expanded" : "pinned")}
        onStartDrag={startDrag}
        onRequestCompact={() => setSurfaceState("compact")}
      />
    </div>
  );
}
