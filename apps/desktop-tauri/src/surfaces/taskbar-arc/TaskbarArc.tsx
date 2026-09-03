/**
 * Taskbar Arc V2 — Edge Object geometry.
 *
 * A graphite slab that rises out of the taskbar (flush bottom edge, rounded
 * top corners). Idle is pure information: provider instruments (icon + arc +
 * tabular value) and — only when more than one profile exists — a small
 * profile avatar. Clicking morphs the same slab into the Quick Panel.
 *
 * States: IDLE → HOVER PEEK → EXPANDED (Quick Panel) → IDLE.
 * The window resizes/repositions but the surface material and geometry are
 * continuous, so the user perceives one object expanding.
 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  QaSurface,
  QaProviderInstrument,
  QaProfileAvatar,
  QaValue,
  QaStatusIndicator,
  statusOf,
  springSoft,
} from "../../design-system";
import { useProviders } from "../../hooks/useProviders";
import { useProfileStore } from "../../components/ProfileSwitcher";
import { QaProviderIcon } from "../../design-system";
import { refreshProvidersIfStale, refreshProviders } from "../../lib/tauri";
import { resizeTaskbarArc } from "../../lib/surfaceBridge";
import type { ProviderUsageSnapshot } from "../../types/bridge";
import "./taskbar-v2.css";

const IDLE_W = 288;
const IDLE_H = 52;
const PANEL_W = 348;
const PANEL_H = 292;

export interface DemoProvider {
  providerId: string;
  displayName: string;
  remaining: number | null;
  reset?: string | null;
  pace?: string | null;
  error?: string | null;
}

interface TaskbarArcProps {
  /** Demo mode renders synthetic providers and forces state (screenshot gate). */
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

function resetTextOf(p: ProviderUsageSnapshot): string | null {
  const win = p.selectedMetric ?? p.primary;
  return win?.resetDescription ?? null;
}

function shortReset(text: string | null): string | null {
  if (!text) return null;
  const normalized = text
    .replace(/^resets?\s+(in\s+)?/i, "")
    .replace(/^reset\s+/i, "")
    .trim();
  if (/^now$/i.test(normalized)) return "now";
  return normalized.length > 0 ? normalized : null;
}

function Chips({
  providers,
  onClick,
}: {
  providers: DemoProvider[];
  onClick?: () => void;
}) {
  return (
    <>
      {providers.map((p) => {
        const remaining = p.remaining;
        return (
          <QaProviderInstrument
            key={p.providerId}
            icon={
              <span className="qa-tico" aria-hidden="true">
                <QaProviderIcon providerId={p.providerId} size={15} />
              </span>
            }
            remaining={remaining}
            statusOverride={p.error ? "offline" : undefined}
            ariaLabel={`${p.displayName} ${remaining == null ? "unknown" : `${Math.round((remaining ?? 0) * 100)}% remaining`}`}
            onClick={onClick}
            size={28}
          />
        );
      })}
      {providers.length === 0 && (
        <span className="qa-tarc__hint">Add a provider to begin</span>
      )}
    </>
  );
}

function QuickPanelRows({ providers }: { providers: DemoProvider[] }) {
  const sorted = [...providers].sort((a, b) => (a.remaining ?? 2) - (b.remaining ?? 2));
  return (
    <div className="qa-quick-panel__rows">
      {sorted.map((p) => {
        const remaining = p.remaining;
        const pct = remaining == null ? null : Math.round(remaining * 100);
        const status = p.error ? "offline" : statusOf(remaining);
        return (
          <div className="qa-quick-panel__row" key={p.providerId}>
            <span className="qa-tico qa-tico--panel" aria-hidden="true">
              <QaProviderIcon providerId={p.providerId} size={16} />
            </span>
            <div className="qa-quick-panel__meta">
              <span className="qa-quick-panel__name">{p.displayName}</span>
              <span className="qa-reset" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <QaStatusIndicator status={status} />
                {p.error
                  ? "Needs attention"
                  : `${pct == null ? "—" : `${pct}%`} available${p.reset ? ` · resets ${shortReset(p.reset) ?? ""}` : ""}${p.pace ? ` · ${p.pace}` : ""}`}
              </span>
            </div>
            <QaValue>{pct == null ? "—" : `${pct}%`}</QaValue>
          </div>
        );
      })}
      {sorted.length === 0 && (
        <div className="qa-quick-panel__empty">No providers yet — open Settings to add one.</div>
      )}
    </div>
  );
}

export default function TaskbarArc({ demo }: TaskbarArcProps) {
  const live = useProviders({ refreshOnMount: true });
  const profileStore = useProfileStore();
  const [expanded, setExpanded] = useState(demo?.state === "expanded");
  const [hover, setHover] = useState(demo?.state === "hover");

  const demoProviders: DemoProvider[] = useMemo(
    () =>
      demo
        ? [
            { providerId: "claude", displayName: "Claude", remaining: 0.73, reset: "resets in 51m", pace: "1.2× pace" },
            { providerId: "codex", displayName: "Codex", remaining: 0.61, reset: "resets in 4d 4h", pace: "on track" },
            { providerId: "opencode", displayName: "OpenCode", remaining: 0.06, reset: "resets in 2h 10m", pace: "1.8× pace" },
          ]
        : [],
    [demo],
  );

  const providers: DemoProvider[] =
    demoProviders.length > 0
      ? demoProviders
      : (live.providers ?? []).map((p: ProviderUsageSnapshot) => ({
          providerId: p.providerId,
          displayName: p.displayName,
          remaining: remainingOf(p),
          reset: resetTextOf(p),
          pace: null,
          error: p.error,
        }));

  useEffect(() => {
    if (demo) return;
    void refreshProvidersIfStale().catch(() => {});
  }, [demo]);

  useEffect(() => {
    // Content-driven idle width: avatar (when multi-profile) + instruments.
    const avatarW = (profileStore?.profiles.length ?? 1) > 1 ? 30 : 0;
    const w = expanded
      ? PANEL_W
      : Math.max(IDLE_W, 26 + avatarW + providers.length * 74 + 14);
    const h = expanded ? PANEL_H : IDLE_H;
    if (demo) return;
    void resizeTaskbarArc(w, h).catch(() => {});
  }, [expanded, demo, providers.length, profileStore]);

  const multiProfile = (profileStore?.profiles.length ?? 1) > 1;
  const activeProfile = profileStore?.profiles.find((p) => p.id === profileStore?.activeProfileId);

  return (
    <QaSurface
      edge="bottom"
      material={expanded ? "glass" : "graphite"}
      className={`qa-tarc ${hover && !expanded ? "qa-tarc--peek" : ""}`}
      style={{ inset: 0 }}
      role="region"
      ariaLabel="QuotaArc Taskbar Arc"
    >
      <div
        className="qa-tarc__inner"
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
              className="qa-tarc__idle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={springSoft}
            >
              {multiProfile && (
                <QaProfileAvatar
                  name={activeProfile?.name ?? "Profile"}
                  title={`Profile: ${activeProfile?.name ?? "Default"}`}
                />
              )}
              <Chips providers={providers} />
            </motion.div>
          ) : (
            <motion.div
              key="panel"
              className="qa-tarc__panel"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={springSoft}
            >
              <div className="qa-quick-panel__head">
                <span className="qa-quick-panel__brand">QuotaArc</span>
                {multiProfile && (
                  <span className="qa-quick-panel__profile">
                    <QaProfileAvatar name={activeProfile?.name ?? "Profile"} />
                    <QaValue size="meta">{activeProfile?.name ?? "Profile"}</QaValue>
                  </span>
                )}
              </div>
              <QuickPanelRows providers={providers} />
              <div className="qa-quick-panel__footer">
                <button
                  type="button"
                  aria-label="Refresh"
                  title="Refresh"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!demo) void refreshProviders().catch(() => {});
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M12.9 7.1a5 5 0 1 0-1.2 3.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M12.9 3.8v3.3H9.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button type="button" aria-label="History" title="History" onClick={(e) => e.stopPropagation()}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="5.4" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M8 5.2V8l2 1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
                <button type="button" aria-label="Settings" title="Settings" onClick={(e) => e.stopPropagation()}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M2 4.5h8M2 8h5M2 11.5h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <circle cx="12" cy="4.5" r="1.5" fill="currentColor" />
                    <circle cx="9" cy="11.5" r="1.5" fill="currentColor" />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </QaSurface>
  );
}
