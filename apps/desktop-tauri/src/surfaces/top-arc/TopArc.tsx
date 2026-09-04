/** The legacy top-window host for the single Quota Island composition. */
import { useCallback, useEffect, useState } from "react";

import type { StageProvider } from "../../components/orbit/stageTypes";
import { useStageRuntime } from "../../hooks/useStageRuntime";
import { resizeTopArc, type SurfaceWindowState } from "../../lib/surfaceBridge";
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

function islandState(state: SurfaceWindowState): QuotaIslandState {
  return state;
}

export default function TopArc({ demo }: TopArcProps) {
  const runtime = useStageRuntime({ enabled: !demo, surface: "top" });
  const [surfaceState, setSurfaceState] = useState<SurfaceWindowState>(() => initialState(demo));
  const [focus, setFocus] = useState(0);
  const providers = demo ? DEMO_PROVIDERS : runtime.providers;

  useEffect(() => {
    if (demo) return;
    // The webview sends state and density only. Rust remains the authority for
    // the native size before this composition fills the resulting viewport.
    void resizeTopArc(surfaceState, providers.length).catch(() => {});
  }, [demo, providers.length, surfaceState]);

  useEffect(() => {
    if (focus >= providers.length) setFocus(0);
  }, [focus, providers.length]);

  const cycle = useCallback((direction: 1 | -1) => {
    setFocus((current) => providers.length === 0 ? 0 : (current + direction + providers.length) % providers.length);
  }, [providers.length]);

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
        state={islandState(surfaceState)}
        providers={providers}
        focusedIndex={focus}
        onFocusProvider={setFocus}
        onToggleExpanded={() => setSurfaceState((state) => state === "expanded" ? "compact" : "expanded")}
        onRequestCompact={() => setSurfaceState("compact")}
      />
    </div>
  );
}
