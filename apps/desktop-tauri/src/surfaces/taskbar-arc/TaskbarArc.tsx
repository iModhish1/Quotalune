/**
 * Taskbar Arc — LIVE production surface (V8 composition).
 *
 * Consumes the same stage primitives as the capture harness
 * (CatalogTaskbar) with REAL state: persisted catalog theme, live provider
 * snapshots, real reset info, compact/expanded interaction, focus cycling
 * (wheel/keyboard), and honest unavailable states. No synthetic fallbacks.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { listen } from "@tauri-apps/api/event";
import CatalogTaskbarStage, { type StageProvider } from "../../demo/CatalogTaskbar";
import { useProviders } from "../../hooks/useProviders";
import { refreshProvidersIfStale, refreshProviders } from "../../lib/tauri";
import { resizeTaskbarArc } from "../../lib/surfaceBridge";
import type { ProviderUsageSnapshot } from "../../types/bridge";

const W = 820;
const H_EXPANDED = 500;
const H_COMPACT = 400;

interface TaskbarArcProps {
  demo?: { state: "idle" | "hover" | "expanded" };
}

function remainingOf(p: ProviderUsageSnapshot): number | null {
  const win = p.selectedMetric ?? p.primary;
  if (!win) return null;
  if (typeof win.remainingPercent === "number") {
    return Math.max(0, Math.min(1, win.remainingPercent / 100));
  }
  return Math.max(0, Math.min(1, 1 - win.usedPercent / 100));
}

function resetOf(p: ProviderUsageSnapshot): string {
  const win = p.selectedMetric ?? p.primary;
  const text = win?.resetDescription ?? "";
  const shortened = text.replace(/^resets?\s+(in\s+)?/i, "").trim();
  return shortened.length > 0 ? shortened : "—";
}

/** Map live snapshots → stage providers; honest unavailable states. */
function toStageProviders(providers: ProviderUsageSnapshot[]): StageProvider[] {
  return providers.slice(0, 7).map((p) => ({
    id: p.providerId,
    name: p.displayName,
    remaining: p.error == null ? remainingOf(p) : null,
    reset: resetOf(p),
  }));
}

export default function TaskbarArc({ demo }: TaskbarArcProps) {
  const live = useProviders({ refreshOnMount: true });
  const [catalog, setCatalog] = useState<string>("01-obsidian-orbit");
  const [expanded, setExpanded] = useState(demo?.state === "expanded");
  const [focus, setFocus] = useState(0);
  const wheelRef = useRef(0);

  // Persisted catalog theme + live re-theme on broadcast.
  useEffect(() => {
    const load = () =>
      getCatalogTheme().then(setCatalog).catch(() => {});
    load();
    const unlistenPromise = listen("codexbar:settings-updated", load);
    const unlisten = unlistenPromise.catch(() => (() => {}) as () => void);
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (demo) return;
    void refreshProvidersIfStale().catch(() => {});
  }, [demo]);

  const stageProviders = useMemo(
    () => toStageProviders(live.providers ?? []),
    [live.providers],
  );

  // Resize the native window with the stage.
  useEffect(() => {
    if (demo) return;
    const h = expanded ? H_EXPANDED : H_COMPACT;
    void resizeTaskbarArc(W, h).catch(() => {});
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
      <CatalogTaskbarStage
        catalog={catalog}
        state={stageState}
        providers={stageProviders}
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
          ? `${focused.name}: ${focused.remaining == null ? "quota unavailable" : `${Math.round(focused.remaining * 100)} percent remaining`}, resets ${focused.reset}`
          : "No providers connected"}
      </div>
    </div>
  );
}

import { useRef } from "react";
import { getSettingsSnapshot } from "../../lib/tauri";

async function getCatalogTheme(): Promise<string> {
  const s = (await getSettingsSnapshot()) as { catalogTheme?: string };
  return s.catalogTheme ?? "01-obsidian-orbit";
}
