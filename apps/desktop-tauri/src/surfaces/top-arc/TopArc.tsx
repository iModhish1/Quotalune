/**
 * Top Arc V2 — Edge Object notch.
 *
 * A graphite notch descending from the top edge of the screen (flush top,
 * rounded bottom corners). Idle: provider instruments only. Hover: subtle
 * peek. Click: morphs into a compact provider summary — the same object,
 * never a separate window.
 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  QaSurface,
  QaProviderInstrument,
  QaValue,
  QaStatusIndicator,
  statusOf,
  springSoft,
} from "../../design-system";
import { useProviders } from "../../hooks/useProviders";
import { QaProviderIcon } from "../../design-system";
import { refreshProvidersIfStale, refreshProviders } from "../../lib/tauri";
import { resizeTopArc } from "../../lib/surfaceBridge";
import type { ProviderUsageSnapshot } from "../../types/bridge";
import "./toparc-v2.css";

const IDLE_W = 300;
const IDLE_H = 48;
const PANEL_W = 348;
const PANEL_H = 280;

function remainingOf(p: ProviderUsageSnapshot): number | null {
  const win = p.selectedMetric ?? p.primary;
  if (!win) return null;
  if (typeof win.remainingPercent === "number") {
    return Math.max(0, Math.min(1, win.remainingPercent / 100));
  }
  return Math.max(0, Math.min(1, 1 - win.usedPercent / 100));
}

export interface DemoProvider {
  providerId: string;
  displayName: string;
  remaining: number | null;
  reset?: string | null;
  error?: string | null;
}

interface TopArcProps {
  demo?: { state: "idle" | "hover" | "expanded" };
}

export default function TopArc({ demo }: TopArcProps) {
  const live = useProviders({ refreshOnMount: true });
  const [expanded, setExpanded] = useState(demo?.state === "expanded");
  const [hover, setHover] = useState(demo?.state === "hover");

  const demoProviders: DemoProvider[] = useMemo(
    () =>
      demo
        ? [
            { providerId: "claude", displayName: "Claude", remaining: 0.73, reset: "51m" },
            { providerId: "codex", displayName: "Codex", remaining: 0.61, reset: "4d 4h" },
            { providerId: "opencode", displayName: "OpenCode", remaining: 0.06, reset: "2h 10m" },
          ]
        : [],
    [demo],
  );

  const providers: DemoProvider[] =
    demoProviders.length > 0
      ? demoProviders
      : (live.providers ?? []).map((p: ProviderUsageSnapshot) => {
          const win = p.selectedMetric ?? p.primary;
          return {
            providerId: p.providerId,
            displayName: p.displayName,
            remaining: remainingOf(p),
            reset: win?.resetDescription?.replace(/^resets?\s+(in\s+)?/i, "") ?? null,
            error: p.error,
          };
        });

  useEffect(() => {
    if (demo) return;
    void refreshProvidersIfStale().catch(() => {});
  }, [demo]);

  useEffect(() => {
    if (demo) return;
    const w = expanded ? PANEL_W : IDLE_W;
    const h = expanded ? PANEL_H : IDLE_H;
    void resizeTopArc(w, h).catch(() => {});
  }, [expanded, demo]);

  const sorted = useMemo(
    () => [...providers].sort((a, b) => (a.remaining ?? 2) - (b.remaining ?? 2)),
    [providers],
  );

  return (
    <QaSurface
      edge="top"
      material={expanded ? "glass" : "graphite"}
      className={`qa-toparc ${hover && !expanded ? "qa-toparc--peek" : ""}`}
      style={{ inset: 0 }}
      role="region"
      ariaLabel="QuotaArc Top Arc"
    >
      <div
        className="qa-toparc__inner"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => {
          if (demo) return;
          setExpanded((v) => !v);
          if (!expanded) void refreshProviders().catch(() => {});
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {!expanded ? (
            <motion.div
              key="idle"
              className="qa-toparc__idle"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={springSoft}
            >
              {providers.slice(0, 5).map((p) => (
                <QaProviderInstrument
                  key={p.providerId}
                  icon={
                    <span className="qa-tico" aria-hidden="true">
                      <QaProviderIcon providerId={p.providerId} size={15} />
                    </span>
                  }
                  remaining={p.remaining}
                  statusOverride={p.error ? "offline" : undefined}
                  ariaLabel={`${p.displayName} ${p.remaining == null ? "unknown" : `${Math.round((p.remaining ?? 0) * 100)}%`}`}
                  size={26}
                />
              ))}
              {providers.length === 0 && <span className="qa-toparc__hint">QuotaArc</span>}
            </motion.div>
          ) : (
            <motion.div
              key="panel"
              className="qa-toparc__panel"
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={springSoft}
            >
              <div className="qa-quick-panel__head">
                <span className="qa-quick-panel__brand">QuotaArc</span>
              </div>
              <div className="qa-quick-panel__rows">
                {sorted.map((p) => {
                  const pct = p.remaining == null ? null : Math.round(p.remaining * 100);
                  const status = p.error ? "offline" : statusOf(p.remaining);
                  return (
                    <div className="qa-quick-panel__row" key={p.providerId}>
                      <span className="qa-tico qa-tico--panel" aria-hidden="true">
                        <QaProviderIcon providerId={p.providerId} size={16} />
                      </span>
                      <div className="qa-quick-panel__meta">
                        <span className="qa-quick-panel__name">{p.displayName}</span>
                        <span className="qa-reset" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <QaStatusIndicator status={status} />
                          {p.error ? "Needs attention" : `resets in ${p.reset ?? "—"}`}
                        </span>
                      </div>
                      <QaValue>{pct == null ? "—" : `${pct}%`}</QaValue>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </QaSurface>
  );
}
