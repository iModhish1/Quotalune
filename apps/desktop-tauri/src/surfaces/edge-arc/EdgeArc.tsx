/**
 * Edge Arc V3 — narrow screen-edge instrument RAIL.
 *
 * V2's half-capsule wasted the space a giant semicircle needs. V3 is a
 * 64px rail grafted flush onto the screen edge, stacking one ring-instrument
 * per provider: Arc V3 with the provider glyph inside, tabular value
 * beneath. Hover/expand grows rows inward; the rail stays edge-anchored.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { QaSurface, QaValue, QaStatusIndicator, statusOf, springSoft, ArcGaugeV3, QaProviderIcon } from "../../design-system";
import { useProviders } from "../../hooks/useProviders";
import { refreshProvidersIfStale } from "../../lib/tauri";
import { resizeEdgeArc } from "../../lib/surfaceBridge";
import type { ProviderUsageSnapshot } from "../../types/bridge";
import "./edgearc-v3.css";

const ROW_H = 62;
const PAD = 18;

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

  const expanded = demo?.state === "expanded";

  useEffect(() => {
    if (demo) return;
    const height = PAD * 2 + providers.length * ROW_H;
    void resizeEdgeArc(expanded ? 210 : 64, height).catch(() => {});
  }, [providers.length, expanded, demo]);

  return (
    <QaSurface
      edge="right"
      material={expanded ? "glass" : "graphite"}
      className={`qa-earc ${expanded ? "qa-earc--expanded" : ""}`}
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={springSoft}
              aria-label={`${p.displayName} ${pct == null ? "unknown" : `${pct}%`}`}
            >
              <div className="qa-earc__ringwrap">
                <ArcGaugeV3
                  remaining={p.remaining}
                  size={34}
                  stroke={3.2}
                  statusOverride={p.error ? "offline" : undefined}
                  ariaLabel={`${p.displayName} arc`}
                />
                <span className="qa-earc__glyph" aria-hidden="true">
                  <QaProviderIcon providerId={p.providerId} size={13} />
                </span>
              </div>
              <QaValue size="meta">{pct == null ? "–" : pct}</QaValue>
              {expanded && (
                <motion.div
                  className="qa-earc__detail"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={springSoft}
                >
                  <span className="qa-earc__name">
                    {p.displayName}
                    <QaStatusIndicator status={status} />
                  </span>
                  <span className="qa-reset">↻ {p.reset ?? "—"}</span>
                </motion.div>
              )}
            </motion.div>
          );
        })}
        {providers.length === 0 && <span className="qa-earc__empty">·</span>}
      </div>
    </QaSurface>
  );
}
