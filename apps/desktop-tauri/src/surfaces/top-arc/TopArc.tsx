/**
 * Top Arc — QuotaArc's top-center capacity pill.
 *
 * States: compact (default) shows one mini arc + percentage per provider;
 * hover morphs the surface into an expanded card listing usage windows,
 * reset countdowns, and pace when available. Geometry morphs are driven by
 * the motion system; the native window resizes with the content.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArcGauge, AnimatedNumber, springSoft } from "../../design-system";
import { useProviders } from "../../hooks/useProviders";
import { useFormattedResetTime } from "../../hooks/useFormattedResetTime";
import { ProviderIcon } from "../../components/providers/ProviderIcon";
import { resizeTopArc } from "../../lib/surfaceBridge";
import type { ProviderUsageSnapshot } from "../../types/bridge";
import "./TopArc.css";

const COMPACT_WIDTH = 380;
const COMPACT_HEIGHT = 52;
const EXPANDED_WIDTH = 430;
const EXPANDED_ROW = 44;
const EXPANDED_PAD = 44;

function primaryRemaining(p: ProviderUsageSnapshot): number | null {
  const win = p.selectedMetric ?? p.primary;
  if (!win) return null;
  if (typeof win.remainingPercent === "number") {
    return Math.max(0, Math.min(1, win.remainingPercent / 100));
  }
  return Math.max(0, Math.min(1, 1 - win.usedPercent / 100));
}

function CompactRow({ provider }: { provider: ProviderUsageSnapshot }) {
  const remaining = primaryRemaining(provider);
  return (
    <motion.div
      className="top-arc__chip"
      layout
      transition={springSoft}
      aria-label={`${provider.displayName} ${remaining == null ? "unknown" : `${Math.round((remaining ?? 0) * 100)} percent remaining`}`}
    >
      <ArcGauge
        remaining={remaining}
        size={26}
        stroke={3.4}
        gapDeg={100}
        ariaLabel={`${provider.displayName} capacity arc`}
      />
      <AnimatedNumber
        className="top-arc__chip-value"
        value={remaining == null ? null : remaining * 100}
        format={(v) => `${Math.round(v)}%`}
      />
    </motion.div>
  );
}

function ExpandedRow({ provider }: { provider: ProviderUsageSnapshot }) {
  const remaining = primaryRemaining(provider);
  const rateWindow = provider.selectedMetric ?? provider.primary;
  const formatted = useFormattedResetTime(rateWindow?.resetsAt ?? null, null, true);

  return (
    <motion.div className="top-arc__detail-row" layout transition={springSoft}>
      <span className="top-arc__detail-icon">
        <ProviderIcon providerId={provider.providerId} size={14} />
      </span>
      <span className="top-arc__detail-name">{provider.displayName}</span>
      {provider.planName && (
        <span className="top-arc__detail-plan">{provider.planName}</span>
      )}
      <span className="top-arc__detail-reset">
        {formatted ?? ""}
      </span>
      <AnimatedNumber
        className="top-arc__detail-percent"
        value={remaining == null ? null : remaining * 100}
        format={(v) => `${Math.round(v)}%`}
      />
      <ArcGauge
        remaining={remaining}
        size={30}
        stroke={3.6}
        gapDeg={100}
        showDot={false}
        ariaLabel={`${provider.displayName} capacity arc`}
      />
    </motion.div>
  );
}

export default function TopArc() {
  const { providers, isRefreshing } = useProviders({ refreshOnMount: true });
  const [hover, setHover] = useState(false);
  const hoverTimer = useRef<number | null>(null);

  const visible = useMemo(
    () => providers.slice(0, 6),
    [providers],
  );

  useEffect(() => {
    const height = hover
      ? EXPANDED_PAD + Math.max(1, visible.length) * EXPANDED_ROW
      : COMPACT_HEIGHT;
    void resizeTopArc(hover ? EXPANDED_WIDTH : COMPACT_WIDTH, height).catch(() => {});
  }, [hover, visible.length]);

  const onEnter = () => {
    if (hoverTimer.current != null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHover(true), 140);
  };
  const onLeave = () => {
    if (hoverTimer.current != null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setHover(false);
  };

  return (
    <div
      className="top-arc"
      data-expanded={hover ? "true" : "false"}
      data-refreshing={isRefreshing ? "true" : "false"}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <AnimatePresence mode="wait" initial={false}>
        {hover ? (
          <motion.div
            key="expanded"
            className="top-arc__expanded"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={springSoft}
          >
            {visible.map((p) => (
              <ExpandedRow key={p.providerId} provider={p} />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="compact"
            className="top-arc__compact"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={springSoft}
          >
            <span className="top-arc__brand" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 32 32">
                <circle
                  cx="16"
                  cy="16"
                  r="10"
                  fill="none"
                  stroke="var(--qa-hairline-strong)"
                  strokeWidth="3.4"
                />
                <path
                  d="M 9.9 22.1 A 10 10 0 1 1 22.1 22.1"
                  fill="none"
                  stroke="var(--qa-accent)"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            {visible.map((p) => (
              <CompactRow key={p.providerId} provider={p} />
            ))}
            {visible.length === 0 && (
              <span className="top-arc__empty">No providers connected</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
