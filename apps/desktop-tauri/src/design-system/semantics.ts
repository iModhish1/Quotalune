/**
 * QuotaArc status semantics — the shared meaning of quota states.
 *
 * Every surface (arcs, rows, tray, notifications) derives color and
 * labeling from here so a critical quota looks the same everywhere.
 * Color is never the only signal: `label` and shape hints accompany it.
 */

export type QuotaStatus =
  | "healthy"
  | "moderate"
  | "high"
  | "critical"
  | "unknown"
  | "offline"
  | "refreshing";

/** 0..=1 fraction of quota consumed. */
export function statusForUsage(used: number | null | undefined): QuotaStatus {
  if (used == null || !Number.isFinite(used)) return "unknown";
  if (used >= 0.95) return "critical";
  if (used >= 0.9) return "high";
  if (used >= 0.75) return "moderate";
  return "healthy";
}

/** CSS custom property references from tokens.css. */
export const STATUS_TOKEN: Record<QuotaStatus, string> = {
  healthy: "var(--qa-status-healthy)",
  moderate: "var(--qa-status-moderate)",
  high: "var(--qa-status-high)",
  critical: "var(--qa-status-critical)",
  unknown: "var(--qa-status-unknown)",
  offline: "var(--qa-status-offline)",
  refreshing: "var(--qa-status-refreshing)",
};

/** Short human label; surfaces localize via i18n where a full sentence is needed. */
export const STATUS_LABEL: Record<QuotaStatus, string> = {
  healthy: "Healthy",
  moderate: "Elevated",
  high: "High",
  critical: "Critical",
  unknown: "Unknown",
  offline: "Offline",
  refreshing: "Refreshing",
};

/**
 * Arc visual weight by status: critical arcs get slightly thicker strokes so
 * the shape itself carries urgency (color-independent signal).
 */
export const STATUS_STROKE_BIAS: Record<QuotaStatus, number> = {
  healthy: 0,
  moderate: 0,
  high: 0.5,
  critical: 1,
  unknown: 0,
  offline: 0,
  refreshing: 0,
};
