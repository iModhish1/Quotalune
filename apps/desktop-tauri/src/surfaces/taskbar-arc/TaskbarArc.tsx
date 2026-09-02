/**
 * Taskbar Arc — taskbar-adjacent capacity strip.
 *
 * Sits centered on the work-area bottom edge (just above the Windows
 * taskbar). Compact chips per account-carrying provider plus the active
 * profile mark; hover expands rows with percentages.
 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArcGauge, AnimatedNumber, springSoft } from "../../design-system";
import { useProviders } from "../../hooks/useProviders";
import { ProviderIcon } from "../../components/providers/ProviderIcon";
import ProfileSwitcher, { usePrivacyMode } from "../../components/ProfileSwitcher";
import { resizeTaskbarArc } from "../../lib/surfaceBridge";
import type { ProviderUsageSnapshot } from "../../types/bridge";
import "./TaskbarArc.css";

const BASE_WIDTH = 340;
const BASE_HEIGHT = 40;
const EXPANDED_HEIGHT = 64;

function primaryRemaining(p: ProviderUsageSnapshot): number | null {
  const win = p.selectedMetric ?? p.primary;
  if (!win) return null;
  if (typeof win.remainingPercent === "number") {
    return Math.max(0, Math.min(1, win.remainingPercent / 100));
  }
  return Math.max(0, Math.min(1, 1 - win.usedPercent / 100));
}

export default function TaskbarArc() {
  const { providers } = useProviders({ refreshOnMount: false });
  const privacy = usePrivacyMode();
  const [hover, setHover] = useState(false);

  const visible = useMemo(() => providers.filter((p) => p.error == null).slice(0, 5), [providers]);

  useEffect(() => {
    void resizeTaskbarArc(BASE_WIDTH, hover ? EXPANDED_HEIGHT : BASE_HEIGHT).catch(() => {});
  }, [hover]);

  return (
    <div
      className="taskbar-arc"
      data-hover={hover ? "true" : "false"}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="taskbar-arc__profile">
        <ProfileSwitcher />
      </div>
      <div className="taskbar-arc__chips">
        {visible.map((p) => {
          const remaining = primaryRemaining(p);
          return (
            <motion.div
              key={p.providerId}
              className="taskbar-arc__chip"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={springSoft}
              aria-label={`${p.displayName} ${privacy ? "" : `${Math.round((remaining ?? 0) * 100)} percent remaining`}`}
            >
              <ProviderIcon providerId={p.providerId} size={13} />
              <ArcGauge
                remaining={remaining}
                size={22}
                stroke={3}
                gapDeg={110}
                showDot={false}
                ariaLabel={`${p.displayName} arc`}
              />
              <AnimatedNumber
                className="taskbar-arc__value"
                value={remaining == null ? null : remaining * 100}
                format={(v) => (privacy ? "··" : `${Math.round(v)}%`)}
              />
            </motion.div>
          );
        })}
        {visible.length === 0 && <span className="taskbar-arc__empty">·</span>}
      </div>
      <AnimatePresence>
        {hover && (
          <motion.div
            className="taskbar-arc__expand-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {privacy ? "QuotaArc" : "QuotaArc · live"}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
