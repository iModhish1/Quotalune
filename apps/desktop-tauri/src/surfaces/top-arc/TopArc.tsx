/** Live catalog-themed top orbital notch. */
import { useCallback, useEffect, useState } from "react";

import TopOrbitStage from "../../components/top/TopOrbitStage";
import {
  TOP_ORBIT_COMPACT_HEIGHT,
  TOP_ORBIT_COMPACT_WIDTH,
  TOP_ORBIT_EXPANDED_HEIGHT,
  TOP_ORBIT_EXPANDED_WIDTH,
} from "../../components/top/topOrbitLayout";
import type { StageProvider } from "../../components/orbit/stageTypes";
import { useStageRuntime } from "../../hooks/useStageRuntime";
import { resizeTopArc } from "../../lib/surfaceBridge";

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

export default function TopArc({ demo }: TopArcProps) {
  const runtime = useStageRuntime({ enabled: !demo });
  const [expanded, setExpanded] = useState(demo?.state === "expanded");
  const [focus, setFocus] = useState(0);
  const providers = demo ? DEMO_PROVIDERS : runtime.providers;

  useEffect(() => {
    if (demo) return;
    void resizeTopArc(
      expanded ? TOP_ORBIT_EXPANDED_WIDTH : TOP_ORBIT_COMPACT_WIDTH,
      expanded ? TOP_ORBIT_EXPANDED_HEIGHT : TOP_ORBIT_COMPACT_HEIGHT,
    ).catch(() => {});
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
      if (event.key === "ArrowRight" || event.key === "ArrowDown") cycle(1);
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") cycle(-1);
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cycle, demo]);

  return (
    <TopOrbitStage
      catalog={runtime.catalog}
      state={demo?.state ?? (expanded ? "expanded" : "idle")}
      providers={providers}
      focusedIndex={focus}
      onFocusProvider={setFocus}
      onToggleExpanded={demo ? undefined : () => {
        setExpanded((value) => !value);
        if (!expanded) runtime.refresh();
      }}
    />
  );
}
