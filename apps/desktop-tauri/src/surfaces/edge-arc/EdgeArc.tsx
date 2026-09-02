/**
 * Edge Arc — QuotaArc's signature vertical edge surface.
 *
 * A compact glass strip attached to a screen edge showing one capacity arc
 * per provider. Hover expands rows to reveal names and percentages; the
 * native window stays non-activating and (optionally) click-through.
 * Size is reported to the shell whenever the provider set changes.
 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArcGauge, AnimatedNumber, springSoft } from "../../design-system";
import { useProviders } from "../../hooks/useProviders";
import { useLocale } from "../../hooks/useLocale";
import { ProviderIcon } from "../../components/providers/ProviderIcon";
import { refreshProvidersIfStale } from "../../lib/tauri";
import { resizeEdgeArc } from "../../lib/surfaceBridge";
import type { ProviderUsageSnapshot } from "../../types/bridge";
import "./EdgeArc.css";

const ROW_HEIGHT = 64;
const PADDING = 12;
const BASE_WIDTH = 76;

function primaryRemaining(p: ProviderUsageSnapshot): number | null {
  const win = p.selectedMetric ?? p.primary;
  if (!win || win.usedPercent == null && win.remainingPercent == null) return null;
  if (typeof win.remainingPercent === "number") {
    return Math.max(0, Math.min(1, win.remainingPercent / 100));
  }
  return Math.max(0, Math.min(1, 1 - win.usedPercent / 100));
}

function isUsable(p: ProviderUsageSnapshot): boolean {
  return p.error == null && primaryRemaining(p) != null;
}

export default function EdgeArc() {
  const { providers, isRefreshing, hasLoadedCache } = useProviders({
    refreshOnMount: true,
  });
  const { t } = useLocale();
  const [hover, setHover] = useState(false);

  const visible = useMemo(
    () => providers.filter((p) => isUsable(p) || p.error != null),
    [providers],
  );

  useEffect(() => {
    const height = PADDING * 2 + visible.length * ROW_HEIGHT;
    void resizeEdgeArc(BASE_WIDTH, Math.max(160, height)).catch(() => {});
  }, [visible.length]);

  useEffect(() => {
    void refreshProvidersIfStale().catch(() => {});
  }, []);

  return (
    <div
      className="edge-arc"
      data-hover={hover ? "true" : "false"}
      data-refreshing={isRefreshing ? "true" : "false"}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <AnimatePresence initial={false}>
        {!hasLoadedCache ? null : visible.length === 0 ? (
          <motion.div
            key="empty"
            className="edge-arc__empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ArcGauge remaining={null} size={40} ariaLabel="No provider capacity" />
            <motion.span className="edge-arc__empty-hint">
              {t("LoadingShellContractHint")}
            </motion.span>
          </motion.div>
        ) : (
          visible.map((p) => {
            const remaining = primaryRemaining(p);
            return (
              <motion.div
                key={p.providerId}
                className="edge-arc__row"
                data-error={p.error != null ? "true" : "false"}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={springSoft}
                aria-label={`${p.displayName} ${remaining == null ? "unknown" : `${Math.round(remaining * 100)} percent remaining`}`}
              >
                <ArcGauge
                  remaining={remaining}
                  size={46}
                  stroke={5}
                  ariaLabel={`${p.displayName} capacity arc`}
                />
                <AnimatePresence>
                  {hover && (
                    <motion.div
                      className="edge-arc__row-detail"
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={springSoft}
                    >
                      <span className="edge-arc__provider">
                        <ProviderIcon providerId={p.providerId} size={12} />
                        <span className="edge-arc__provider-name">{p.displayName}</span>
                      </span>
                      <AnimatedNumber
                        className="edge-arc__percent"
                        value={remaining == null ? null : remaining * 100}
                        format={(v) => `${Math.round(v)}%`}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </AnimatePresence>
    </div>
  );
}
