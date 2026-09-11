/** Compact magnitude-based token/count formatting for Analytics summary
 *  cards and tables (owner: "Do not expose raw giant integers everywhere" --
 *  confirmed via native inspection of Analytics -> Tokens/Models against a
 *  real machine with tens of billions of accumulated local tokens, where
 *  full digit strings like "63,747,046,211" dominated the page).
 *
 *  Below 1,000 shows the exact integer (small counts are more useful exact
 *  than compact). At or above 1,000, shows one decimal place with a
 *  k/M/B/T suffix, dropping the decimal when it would render as ".0".
 *  Tabular-numeral friendly: fixed one decimal, no locale-dependent
 *  grouping in the compact form. Use `formatExactTokens` for a tooltip's
 *  precise value alongside the compact one. */
export function formatCompactTokens(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  if (abs < 1000) return String(Math.trunc(value));
  const units: [number, string][] = [
    [1_000_000_000_000, "T"],
    [1_000_000_000, "B"],
    [1_000_000, "M"],
    [1_000, "k"],
  ];
  for (const [threshold, suffix] of units) {
    if (abs >= threshold) {
      const scaled = value / threshold;
      const rounded = Math.round(scaled * 10) / 10;
      const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
      return `${text}${suffix}`;
    }
  }
  return String(Math.trunc(value));
}

/** The full, exact integer with locale grouping -- for a tooltip's precise
 *  value alongside the compact summary-card figure. */
export function formatExactTokens(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Math.trunc(value).toLocaleString();
}
