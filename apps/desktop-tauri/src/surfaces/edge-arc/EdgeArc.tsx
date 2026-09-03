/**
 * Edge Arc V2 — Edge Object pod.
 *
 * A half-capsule pod grafted onto the screen edge: flush against the
 * physical edge, rounded on the free side. Providers appear as arc
 * instruments (Cluster layout); hovering an instrument reveals its name and
 * reset inline. Height follows the provider count via the shell resize.
 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { QaSurface, QaValue, QaStatusIndicator, statusOf, springSoft } from "../../design-system";
import { useProviders } from "../../hooks/useProviders";
import { QaProviderIcon } from "../../design-system";
import { refreshProvidersIfStale } from "../../lib/tauri";
import { resizeEdgeArc } from "../../lib/surfaceBridge";
import type { ProviderUsageSnapshot } from "../../types/bridge";
import "./edgearc-v2.css";

const ROW_H = 52;
const PAD = 24;

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

interface EdgeArcProps {
  demo?: { state: "idle" | "expanded" };
}

export default function EdgeArc({ demo }: EdgeArcProps) {
  const live = useProviders({ refreshOnMount: true });
  const [hoverId, setHoverId] = useState<string | null>(null);

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

  const height = PAD * 2 + Math.max(1, providers.length) * ROW_H;
  useEffect(() => {
    if (demo) return;
    void resizeEdgeArc(150, height).catch(() => {});
  }, [height, demo]);

  return (
    <QaSurface
      edge="right"
      material="graphite"
      className="qa-earc"
      style={{ inset: 0 }}
      role="region"
      ariaLabel="QuotaArc Edge Arc"
    >
      <div className="qa-earc__inner">
        {providers.slice(0, 6).map((p) => {
          const pct = p.remaining == null ? null : Math.round(p.remaining * 100);
          const status = p.error ? "offline" : statusOf(p.remaining);
          const hovered = hoverId === p.providerId;
          return (
            <motion.div
              key={p.providerId}
              className="qa-earc__inst"
              data-hover={hovered ? "true" : "false"}
              onMouseEnter={() => setHoverId(p.providerId)}
              onMouseLeave={() => setHoverId(null)}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={springSoft}
              aria-label={`${p.displayName} ${pct == null ? "unknown" : `${pct}%`}`}
            >
              <span className="qa-tico" aria-hidden="true">
                <QaProviderIcon providerId={p.providerId} size={15} />
              </span>
              <span className="qa-earc__arcwrap" style={{ position: "relative", display: "grid", placeItems: "center" }}>
                {useArc(p)}
                <span
                  className="qa-value"
                  style={{ position: "absolute", fontSize: "10.5px" }}
                >
                  {pct ?? "–"}
                </span>
              </span>
              <AnimatePresence>
                {hovered && (
                  <motion.div
                    className="qa-earc__detail"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={springSoft}
                  >
                    <span className="qa-earc__name">{p.displayName}</span>
                    <span className="qa-reset" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <QaStatusIndicator status={status} />
                      {p.error ? "needs attention" : `resets ${p.reset ?? "—"}`}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
        {providers.length === 0 && <span className="qa-earc__empty">·</span>}
      </div>
    </QaSurface>
  );
}

import { QaCapacityArc } from "../../design-system";
function useArc(p: DemoProvider) {
  return (
    <QaCapacityArc
      remaining={p.remaining}
      size={34}
      stroke={3.2}
      gapDeg={110}
      showDot={false}
      ariaLabel={`${p.displayName} arc`}
    />
  );
}
