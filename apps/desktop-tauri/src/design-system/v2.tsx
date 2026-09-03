/**
 * QuotaArc V2 components — the single geometry/material/motion language.
 * Every surface composes these; no surface-owned duplicates.
 */
import { memo } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ArcGauge } from "./ArcGauge";
import { ProviderIcon } from "../components/providers/ProviderIcon";
import { statusForUsage, STATUS_LABEL, type QuotaStatus } from "./semantics";
import "./v2.css";

/* ── QaSurface ──────────────────────────────────────────────────────── */

export type QaEdge = "none" | "bottom" | "top" | "left" | "right";
export type QaMaterial = "graphite" | "glass";

export interface QaSurfaceProps {
  edge?: QaEdge;
  material?: QaMaterial;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  role?: string;
  ariaLabel?: string;
}

export function QaSurface({
  edge = "none",
  material = "graphite",
  children,
  className = "",
  style,
  onClick,
  role,
  ariaLabel,
}: QaSurfaceProps) {
  const edgeClass = edge === "none" ? "" : `qa-surface--edge-${edge}`;
  const materialClass = material === "glass" ? "qa-surface--glass" : "";
  return (
    <div
      className={`qa-surface ${edgeClass} ${materialClass} ${className}`}
      style={style}
      onClick={onClick}
      role={role}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

/* ── QaCapacityArc (V2 wrapper over the arc engine) ─────────────────── */

export interface QaCapacityArcProps {
  /** Remaining fraction 0..=1, or null for unknown. */
  remaining: number | null;
  size?: number;
  stroke?: number;
  gapDeg?: number;
  statusOverride?: QuotaStatus;
  showDot?: boolean;
  ariaLabel: string;
  className?: string;
}

export function QaCapacityArc({
  remaining,
  size = 24,
  stroke = 3,
  gapDeg = 90,
  statusOverride,
  showDot = false,
  ariaLabel,
  className,
}: QaCapacityArcProps) {
  return (
    <ArcGauge
      remaining={remaining}
      size={size}
      stroke={stroke}
      gapDeg={gapDeg}
      statusOverride={statusOverride}
      showDot={showDot}
      ariaLabel={ariaLabel}
      className={className}
    />
  );
}

/** Micro arc without inner value (dense chips). */
export function QaMicroArc(props: Omit<QaCapacityArcProps, "showDot">) {
  return <QaCapacityArc {...props} size={props.size ?? 20} stroke={props.stroke ?? 2.5} />;
}

/* ── QaProviderIcon: normalized optical box for foreign artwork ─────── */

/**
 * Optical compensation per provider: source glyphs have different visual
 * weights, so each gets a scale factor inside the fixed 18×18 optical box
 * (the interaction box stays 20×20 via .qa-tico).
 */
const ICON_OPTICAL: Record<string, number> = {
  claude: 0.95,
  codex: 0.88,
  copilot: 0.92,
  opencode: 0.88,
  opencodego: 0.88,
  gemini: 0.92,
  cursor: 0.9,
  openrouter: 0.9,
  deepseek: 0.95,
  groq: 0.9,
};

export function QaProviderIcon({
  providerId,
  size = 15,
}: {
  providerId: string;
  size?: number;
}) {
  const scale = ICON_OPTICAL[providerId] ?? 0.92;
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: size,
        height: size,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          transform: `scale(${scale})`,
          transformOrigin: "center",
        }}
      >
        <ProviderIcon providerId={providerId} size={size} />
      </span>
    </span>
  );
}

/* ── QaValue ────────────────────────────────────────────────────────── */

export function QaValue({
  children,
  size = "md",
  className = "",
}: {
  children: ReactNode;
  size?: "meta" | "md" | "lg";
  className?: string;
}) {
  const mod = size === "meta" ? " qa-value--meta" : size === "lg" ? " qa-value--lg" : "";
  return <span className={`qa-value${mod} ${className}`}>{children}</span>;
}

/* ── QaResetTime ────────────────────────────────────────────────────── */

export function QaResetTime({ text }: { text?: string | null }) {
  if (!text) return null;
  return <span className="qa-reset">{text}</span>;
}

/* ── QaStatusIndicator ──────────────────────────────────────────────── */

export function QaStatusIndicator({ status }: { status: QuotaStatus }) {
  return <span className={`qa-status-dot qa-status-dot--${status}`} title={STATUS_LABEL[status]} />;
}

/** Usage fraction → status, shared. */
export function statusOf(remaining: number | null): QuotaStatus {
  if (remaining == null) return "unknown";
  return statusForUsage(1 - remaining);
}

/* ── QaProfileAvatar: identity without a name label ─────────────────── */

export function QaProfileAvatar({
  name,
  title,
  onClick,
}: {
  name: string;
  title?: string;
  onClick?: () => void;
}) {
  const letter = name.trim().slice(0, 1).toUpperCase() || "•";
  return (
    <span
      className="qa-avatar"
      title={title ?? name}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      aria-label={title ?? `Profile ${name}`}
    >
      {letter}
    </span>
  );
}

/* ── QaProviderInstrument ───────────────────────────────────────────── */

export interface QaProviderInstrumentProps {
  icon: ReactNode;
  /** Remaining fraction 0..=1 or null. */
  remaining: number | null;
  /** Show the numeric value inside/beside the arc (idle chips: yes). */
  showValue?: boolean;
  size?: number;
  statusOverride?: QuotaStatus;
  ariaLabel: string;
  onClick?: () => void;
  className?: string;
}

/**
 * The atomic capacity unit: provider icon + capacity arc + tabular value.
 * Compact surfaces are built from these alone — no names, no chrome.
 */
export function QaProviderInstrument({
  icon,
  remaining,
  showValue = true,
  size = 26,
  statusOverride,
  ariaLabel,
  onClick,
  className = "",
}: QaProviderInstrumentProps) {
  const pct = remaining == null ? null : Math.round(remaining * 100);
  return (
    <span
      className={`qa-instrument ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      aria-label={ariaLabel}
    >
      {icon}
      <span className="arc-slot" style={{ position: "relative", display: "grid", placeItems: "center" }}>
        <QaCapacityArc
          remaining={remaining}
          size={size}
          stroke={size >= 30 ? 3.2 : 2.6}
          gapDeg={90}
          statusOverride={statusOverride}
          ariaLabel={ariaLabel}
        />
        {showValue && (
          <span
            className="qa-value"
            style={{ position: "absolute", fontSize: size >= 30 ? "11.5px" : "10px" }}
          >
            {pct ?? "–"}
          </span>
        )}
      </span>
    </span>
  );
}

export const QaProviderInstrumentMemo = memo(QaProviderInstrument);
