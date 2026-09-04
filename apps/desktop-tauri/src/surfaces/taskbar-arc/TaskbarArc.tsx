/**
 * Taskbar Arc — LIVE production surface (V8 composition).
 *
 * Consumes the production TaskbarStage also used by the capture harness,
 * with REAL state: persisted catalog theme, live provider
 * snapshots, real reset info, compact/expanded interaction, focus cycling
 * (wheel/keyboard), and honest unavailable states. No synthetic fallbacks.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import TaskbarStage from "../../components/taskbar/TaskbarStage";
import {
  TASKBAR_COMPACT_HEIGHT,
  TASKBAR_EXPANDED_HEIGHT,
  TASKBAR_STAGE_WIDTH,
} from "../../components/taskbar/taskbarLayout";
import { resizeTaskbarArc } from "../../lib/surfaceBridge";
import { useStageRuntime } from "../../hooks/useStageRuntime";

export { toStageProviders, usageConfigFromSnapshot } from "../../components/orbit/stageProviders";

interface TaskbarArcProps {
  demo?: { state: "idle" | "hover" | "expanded" };
}

export default function TaskbarArc({ demo }: TaskbarArcProps) {
  const runtime = useStageRuntime({ enabled: !demo, surface: "taskbar" });
  const [expanded, setExpanded] = useState(demo?.state === "expanded");
  const [focus, setFocus] = useState(0);
  const wheelRef = useRef(0);

  const stageProviders = runtime.providers;

  // Resize the native window with the stage.
  useEffect(() => {
    if (demo) return;
    // State data only — the Rust layout runtime computes the geometry.
    void resizeTaskbarArc(expanded ? "expanded" : "compact", stageProviders.length).catch(
      () => {},
    );
  }, [expanded, demo]);

  const cycle = useCallback(
    (dir: 1 | -1) => {
      setFocus((prev) => {
        const n = stageProviders.length;
        if (n === 0) return prev;
        return (prev + dir + n) % n;
      });
    },
    [stageProviders.length],
  );

  // Focus falls back deterministically if the focused provider disappears.
  useEffect(() => {
    if (focus >= stageProviders.length) setFocus(0);
  }, [stageProviders.length, focus]);

  // Wheel cycling over the orbit (detent anti-flicker).
  useEffect(() => {
    if (demo) return;
    let last = 0;
    const el = document.getElementById("qa-taskbar-root");
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now - last < 120) return;
      last = now;
      cycle(e.deltaY > 0 ? 1 : -1);
    };
    el?.addEventListener("wheel", onWheel, { passive: false });
    return () => el?.removeEventListener("wheel", onWheel);
  }, [cycle, demo]);

  // Keyboard cycling + escape collapse.
  useEffect(() => {
    if (demo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); cycle(1); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); cycle(-1); }
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycle, demo]);

  const stageState = demo?.state ?? (expanded ? "expanded" : "idle");
  const focused = stageProviders[focus];

  return (
    <div id="qa-taskbar-root" style={{ position: "fixed", inset: 0 }}>
      <TaskbarStage
        catalog={runtime.catalog}
        state={stageState}
        providers={stageProviders}
        focusedIndex={focus}
        onFocusProvider={setFocus}
        onToggleExpanded={demo ? undefined : () => setExpanded((value) => !value)}
      />
      {/* collapse affordance (expanded) */}
      {expanded && !demo && (
        <motion.button
          key="collapse"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-label="Collapse to taskbar seam"
          onClick={() => setExpanded(false)}
          style={{
            position: "absolute",
            right: 14,
            top: 12,
            width: 26,
            height: 26,
            borderRadius: 8,
            border: "1px solid var(--qa-hairline)",
            background: "rgba(255,255,255,0.05)",
            color: "var(--qa-ink-2)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          ✕
        </motion.button>
      )}
      {/* screen-reader live region for focused provider */}
      <div
        aria-live="polite"
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}
      >
        {focused
          ? `${focused.name}: ${focused.primaryValue == null ? "quota unavailable" : `${Math.round(focused.primaryValue)} percent ${focused.primaryLabel}`}, resets ${focused.reset}`
          : "No providers connected"}
      </div>
    </div>
  );
}
