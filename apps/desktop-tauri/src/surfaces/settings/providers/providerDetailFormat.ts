import type { ProviderDetail } from "../../../types/bridge";
import type { LocaleKey } from "../../../i18n/keys";

export function buildSubtitle(
  detail: ProviderDetail,
  t: (k: LocaleKey) => string,
  language = "en",
): string {
  const parts: string[] = [];
  if (detail.sourceLabel) parts.push(detail.sourceLabel);
  if (detail.lastUpdated) {
    const ago = relativeAgo(detail.lastUpdated, language);
    if (ago) parts.push(`${t("DetailUpdatedPrefix")} ${ago}`);
  } else if (!detail.hasSnapshot) {
    parts.push(t("ProviderUsageNotFetchedYet"));
  }
  return parts.join(" · ");
}

export function relativeAgo(iso: string, language = "en"): string | null {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = Date.now() - t;
  const secs = Math.round(Math.abs(diff) / 1000);
  const format = (value: number, unit: Intl.RelativeTimeFormatUnit, suffix: string) =>
    language.toLowerCase().startsWith("ar")
      ? new Intl.RelativeTimeFormat("ar-SA-u-nu-latn", { numeric: "always", style: "short" }).format(-value, unit)
      : `${value}${suffix}`;
  if (secs < 60) return format(secs, "second", "s");
  const mins = Math.round(secs / 60);
  if (mins < 60) return format(mins, "minute", "m");
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return format(hrs, "hour", "h");
  return format(Math.round(hrs / 24), "day", "d");
}
