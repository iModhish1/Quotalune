/** The native window host for QuotaArc's one adaptive Flow Surface. */
import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";

import type { StageProvider } from "../../components/orbit/stageTypes";
import {
  DEFAULT_FLOW_SURFACE_SETTINGS,
  hasSurfaceQuotaValue,
  normalizeFlowSurfaceSettings,
  type FlowSurfaceSettings,
  type FlowSurfaceState,
} from "../../design-system/flowSurface";
import { useStageRuntime } from "../../hooks/useStageRuntime";
import {
  beginQuotaIslandDrag,
  getSurfaceSettings,
  resizeTopArc,
  type SurfaceSettings,
  type SurfaceWindowState,
} from "../../lib/surfaceBridge";
import FlowSurface from "../flow-surface/FlowSurface";
import { useSurfaceDemo } from "../../hooks/useSurfaceDemo";
import { SURFACE_DEMO_PROVIDERS } from "../../lib/surfaceDemo";

const DEMO_PROVIDERS: StageProvider[] = [
  { id: "codex", name: "OpenAI", iconId: "openai", resolvedMode: "remaining", arcFraction: 0.74, primaryValue: 74, secondaryValue: 26, primaryLabel: "remaining", reset: "3h 40m", status: "ok" },
  { id: "claude", name: "Claude", iconId: "claude", resolvedMode: "remaining", arcFraction: 0.68, primaryValue: 68, secondaryValue: 32, primaryLabel: "remaining", reset: "26h", status: "ok" },
  { id: "gemini", name: "Gemini", iconId: "gemini", resolvedMode: "remaining", arcFraction: 0.55, primaryValue: 55, secondaryValue: 45, primaryLabel: "remaining", reset: "22h", status: "ok" },
];

interface TopArcProps {
  demo?: { state: "idle" | "hover" | "expanded" };
}

function demoState(demo: TopArcProps["demo"]): FlowSurfaceState {
  if (demo?.state === "expanded") return "expanded";
  if (demo?.state === "hover") return "hover";
  return "compact";
}

function settingsToFlow(settings: SurfaceSettings): FlowSurfaceSettings {
  return normalizeFlowSurfaceSettings({
    form: settings.topArcForm,
    anchor: settings.topArcAnchor,
    scale: settings.topArcScale,
    autoHide: settings.topArcAutoHide,
    autoHideDelayMs: settings.topArcAutoHideDelayMs,
  });
}

function nativeState(state: FlowSurfaceState): SurfaceWindowState {
  return state === "pinned" ? "expanded" : state;
}

export default function TopArc({ demo }: TopArcProps) {
  const surfaceDemo = useSurfaceDemo();
  const runtime = useStageRuntime({ enabled: !demo, surface: "top" });
  const [surfaceState, setSurfaceState] = useState<FlowSurfaceState>(() => demo ? demoState(demo) : "hidden");
  const [flowSettings, setFlowSettings] = useState<FlowSurfaceSettings>(DEFAULT_FLOW_SURFACE_SETTINGS);
  const [focus, setFocus] = useState(0);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const pointerInsideRef = useRef(false);
  const autoHideTimer = useRef<number | null>(null);
  const nativeRevisionRef = useRef<string | null>(null);
  // A registered account is not a rendering entitlement. The compact host
  // receives only resolved values, so it cannot grow into an empty rail.
  const providers = (surfaceDemo.enabled ? SURFACE_DEMO_PROVIDERS : demo ? DEMO_PROVIDERS : runtime.providers).filter(hasSurfaceQuotaValue);

  const clearAutoHide = useCallback(() => {
    if (autoHideTimer.current != null) {
      window.clearTimeout(autoHideTimer.current);
      autoHideTimer.current = null;
    }
  }, []);

  const loadFlowSettings = useCallback(() => {
    if (demo) return Promise.resolve();
    return getSurfaceSettings().then((settings) => setFlowSettings(settingsToFlow(settings))).catch(() => {});
  }, [demo]);

  useEffect(() => {
    void loadFlowSettings();
    if (demo) return undefined;
    const unlisten = listen("quotaarc:surfaces-changed", loadFlowSettings);
    return () => {
      clearAutoHide();
      void unlisten.then((dispose) => dispose()).catch(() => {});
    };
  }, [clearAutoHide, demo, loadFlowSettings]);

  useEffect(() => {
    if (demo || dragging) return;
    const intended = nativeState(surfaceState);
    const revision = `${intended}:${providers.length}:${flowSettings.form}:${flowSettings.scale}:${flowSettings.anchor}`;
    if (nativeRevisionRef.current === revision) return;
    nativeRevisionRef.current = revision;
    void resizeTopArc(intended, providers.length).catch(() => {
      if (nativeRevisionRef.current === revision) nativeRevisionRef.current = null;
    });
  }, [demo, dragging, flowSettings.form, flowSettings.scale, flowSettings.anchor, providers.length, surfaceState]);

  useEffect(() => {
    if (focus >= providers.length) setFocus(0);
  }, [focus, providers.length]);

  const scheduleAutoHide = useCallback(() => {
    clearAutoHide();
    if (draggingRef.current || !flowSettings.autoHide || surfaceState === "expanded" || surfaceState === "pinned") return;
    autoHideTimer.current = window.setTimeout(() => setSurfaceState("hidden"), flowSettings.autoHideDelayMs);
  }, [clearAutoHide, flowSettings.autoHide, flowSettings.autoHideDelayMs, surfaceState]);

  const cycle = useCallback((direction: 1 | -1) => {
    setFocus((current) => providers.length === 0 ? 0 : (current + direction + providers.length) % providers.length);
  }, [providers.length]);

  useEffect(() => {
    if (!pointerInsideRef.current && (surfaceState === "compact" || surfaceState === "hover")) scheduleAutoHide();
    return clearAutoHide;
  }, [surfaceState, scheduleAutoHide, clearAutoHide]);

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
      className="flow-surface-host"
      onMouseEnter={() => {
        pointerInsideRef.current = true;
        clearAutoHide();
        if (draggingRef.current) return;
        setSurfaceState((state) => state === "hidden" || state === "peek" || state === "compact" ? "hover" : state);
      }}
      onMouseLeave={() => {
        pointerInsideRef.current = false;
        scheduleAutoHide();
      }}
    >
      <FlowSurface
        catalog={runtime.catalog}
        settings={flowSettings}
        state={surfaceState}
        providers={providers}
        demoMode={surfaceDemo.enabled}
        focusedIndex={focus}
        onFocusProvider={setFocus}
        onReveal={() => setSurfaceState("compact")}
        onToggleExpanded={() => {
          clearAutoHide();
          setSurfaceState((state) => state === "expanded" || state === "pinned" ? "compact" : "expanded");
        }}
        onTogglePinned={() => setSurfaceState((state) => state === "pinned" ? "expanded" : "pinned")}
        onRequestCompact={() => setSurfaceState("compact")}
        onStartDrag={() => {
          if (draggingRef.current) return;
          clearAutoHide();
          draggingRef.current = true;
          setDragging(true);
          void beginQuotaIslandDrag().catch(() => {}).finally(() => {
            draggingRef.current = false;
            setDragging(false);
            void loadFlowSettings();
            if (!pointerInsideRef.current) scheduleAutoHide();
          });
        }}
      />
    </div>
  );
}
