/** Live catalog-themed right-edge half orbit. */
import { useCallback, useEffect, useState } from "react";

import EdgeOrbitStage from "../../components/edge/EdgeOrbitStage";
import {
  EDGE_ORBIT_COMPACT_HEIGHT,
  EDGE_ORBIT_COMPACT_WIDTH,
  EDGE_ORBIT_EXPANDED_HEIGHT,
  EDGE_ORBIT_EXPANDED_WIDTH,
} from "../../components/edge/edgeOrbitLayout";
import type { StageProvider } from "../../components/orbit/stageTypes";
import { useStageRuntime } from "../../hooks/useStageRuntime";
import { resizeEdgeArc } from "../../lib/surfaceBridge";

const DEMO_PROVIDERS: StageProvider[] = [
  { id: "codex", name: "OpenAI", iconId: "openai", resolvedMode: "remaining", arcFraction: 0.74, primaryValue: 74, secondaryValue: 26, primaryLabel: "remaining", reset: "3h 40m", status: "ok" },
  { id: "claude", name: "Claude", iconId: "claude", resolvedMode: "remaining", arcFraction: 0.68, primaryValue: 68, secondaryValue: 32, primaryLabel: "remaining", reset: "26h", status: "ok" },
  { id: "gemini", name: "Gemini", iconId: "gemini", resolvedMode: "remaining", arcFraction: 0.55, primaryValue: 55, secondaryValue: 45, primaryLabel: "remaining", reset: "22h", status: "ok" },
  { id: "llama", name: "Meta", iconId: "llama", resolvedMode: "remaining", arcFraction: 0.6, primaryValue: 60, secondaryValue: 40, primaryLabel: "remaining", reset: "5d", status: "ok" },
  { id: "mistral", name: "Mistral", iconId: "mistral", resolvedMode: "remaining", arcFraction: 0.45, primaryValue: 45, secondaryValue: 55, primaryLabel: "remaining", reset: "1d", status: "attention" },
  { id: "deepseek", name: "DeepSeek", iconId: "deepseek", resolvedMode: "remaining", arcFraction: 0.7, primaryValue: 70, secondaryValue: 30, primaryLabel: "remaining", reset: "19h", status: "ok" },
  { id: "perplexity", name: "Perplexity", iconId: "perplexity", resolvedMode: "remaining", arcFraction: 0.5, primaryValue: 50, secondaryValue: 50, primaryLabel: "remaining", reset: "3d", status: "ok" },
];

interface EdgeArcProps {
  demo?: { state: "idle" | "hover" | "expanded" };
}

export default function EdgeArc({ demo }: EdgeArcProps) {
  const runtime = useStageRuntime({ enabled: !demo, surface: "edge" });
  const [expanded, setExpanded] = useState(demo?.state === "expanded");
  const [focus, setFocus] = useState(0);
  const providers = demo ? DEMO_PROVIDERS : runtime.providers;

  useEffect(() => {
    if (demo) return;
    // State data only — the Rust layout runtime computes the geometry.
    void resizeEdgeArc(expanded ? "expanded" : "compact", providers.length).catch(() => {});
  }, [expanded, demo]);

  useEffect(() => {
    if (focus >= providers.length) setFocus(0);
  }, [focus, providers.length]);

  const cycle = useCallback((direction: 1 | -1) => {
    setFocus((current) => {
      if (providers.length === 0) return 0;
      return (current + direction + providers.length) % providers.length;
    });
  }, [providers.length]);

  useEffect(() => {
    if (demo) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown" || event.key === "ArrowRight") cycle(1);
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") cycle(-1);
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cycle, demo]);

  return (
    <EdgeOrbitStage
      catalog={runtime.catalog}
      state={demo?.state === "expanded" || expanded ? "expanded" : "idle"}
      providers={providers}
      focusedIndex={focus}
      onFocusProvider={setFocus}
      onToggleExpanded={demo ? undefined : () => setExpanded((value) => !value)}
    />
  );
}
