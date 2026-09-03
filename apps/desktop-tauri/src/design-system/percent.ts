/**
 * QuotaArc centralized percentage formatting.
 *
 * No component may render raw floating-point quota values. All percentages
 * flow through these functions so IEEE-754 artifacts ("20.999999999999996"),
 * negative zero, NaN/Infinity, and out-of-range values can never reach the
 * UI, the accessible name, or the arc geometry.
 */

/**
 * Normalize a quota fraction/percent to a clean finite number.
 *
 * Accepts any numeric input (fraction or percent — caller decides units),
 * returns null for unavailable data (null/undefined/NaN/±Infinity).
 * Snaps values within tolerance of 0 or 100 to the exact bound, clamps
 * out-of-range input, and eliminates negative zero.
 */
export function normalizePercentage(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (Object.is(value, -0)) return 0;
  // Snap floating-point drift near the bounds (e.g. 99.99999999999999).
  if (Math.abs(value) < 1e-9) return 0;
  if (Math.abs(value - 100) < 1e-9) return 100;
  const clamped = Math.min(100, Math.max(0, value));
  // Round away drift below the display precision (12 significant decimals
  // is far beyond any product surface; kills 20.999999999999996 → 21).
  const cleaned = Number(clamped.toPrecision(12));
  return Object.is(cleaned, -0) ? 0 : cleaned;
}

export interface PercentageOptions {
  /** Decimal places (0 = integer percent, the compact/expanded default). */
  decimals?: number;
  /** Include the "%" sign. */
  withSign?: boolean;
}

/**
 * Format a percentage for display.
 *  - null/undefined/NaN/Infinity → "–" (unavailable)
 *  - decimals defaults to 0 (73 → "73%", 20.999999999999996 → "21%")
 *  - no trailing ".0", no scientific notation, no negative zero
 *  - tabular-numeral safe (returns a string; caller applies the font)
 */
export function formatPercentage(
  value: number | null | undefined,
  options: PercentageOptions = {},
): string {
  const normalized = normalizePercentage(value);
  if (normalized === null) return "–";
  const decimals = Math.max(0, Math.min(2, options.decimals ?? 0));
  const fixed = normalized.toFixed(decimals);
  const trimmed = decimals > 0 ? fixed.replace(/\.?0+$/, "") : fixed;
  const sign = options.withSign === false ? "" : "%";
  return `${trimmed}${sign}`;
}

/**
 * Arc geometry input: the normalized fraction (0..=1) the arc should fill,
 * or null when unavailable. Guarantees the arc endpoint agrees with
 * formatPercentage (same normalization, no disagreement).
 */
export function arcFraction(value: number | null | undefined): number | null {
  const normalized = normalizePercentage(value);
  return normalized === null ? null : normalized / 100;
}

/**
 * Compact token notation: 73000 → "73K", 100000 → "100K", 7300 → "7.3K".
 * Returns "–" for unavailable values. Never uses decimals beyond 1.
 */
export function formatTokenCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "–";
  const sign = Object.is(value, -0) || value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}${m >= 100 ? Math.round(m) : Number(m.toFixed(1))}M`;
  }
  if (abs >= 1000) {
    const k = abs / 1000;
    return `${sign}${k >= 100 ? Math.round(k) : Number(k.toFixed(1))}K`;
  }
  return `${sign}${Math.round(abs)}`;
}
