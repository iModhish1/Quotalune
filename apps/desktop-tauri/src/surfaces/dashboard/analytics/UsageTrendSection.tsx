import { useMemo, useState } from "react";
import { useLocale } from "../../../hooks/useLocale";
import { resolveIntlLocale } from "../../../i18n/resolveIntlLocale";
import { LineChart, type LineChartPoint } from "../../../components/charts/LineChart";
import { providerCreditsColor, providerCostColor } from "../../../components/charts/chartPalette";
import { formatPercentage } from "../../../design-system/percent";
import type { DashboardSnapshot } from "../../../types/bridge";

type Metric = "usage" | "spend";

/**
 * Previously used `Intl.DateTimeFormat(undefined, ...)`, which always
 * follows the WebView2 environment's own default locale and completely
 * ignores the app's selected UI language -- an Arabic-language user would
 * still see English month abbreviations ("Sep 4") on the trend axis. Now
 * resolves through the same `resolveIntlLocale` table every other
 * locale-aware Intl call in the app uses.
 *
 * `numberingSystem: "latn"` matches the rest of the app's established
 * digit policy (see `resetPresentation.ts`, which hardcodes the same):
 * dates stay in Latin digits even in Arabic, never Arabic-Indic ("٤").
 */
function bucketFormatter(grain: "hourly" | "daily", timezone: string, uiLocale: string) {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    numberingSystem: "latn",
    ...(grain === "hourly" ? { hour: "numeric" } : { month: "short", day: "numeric" }),
  };
  try {
    return new Intl.DateTimeFormat(uiLocale, options);
  } catch {
    const { timeZone: _timeZone, ...fallback } = options;
    return new Intl.DateTimeFormat(uiLocale, fallback);
  }
}

function groupByProvider<T extends { provider: string; accountId: string; bucketStart: number }>(
  points: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const p of points) {
    const key = `${p.provider}:${p.accountId}`;
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.bucketStart - b.bucketStart);
  }
  return groups;
}

/**
 * The hero analytics visual (owner section 10-12): usage/spend trend from
 * real local history, aggregated at the grain the backend already chose
 * for the selected range (hourly for Today, daily otherwise -- no
 * re-bucketing here). Renders one small-multiple line per provider
 * rather than a single fabricated "all providers averaged" series, since
 * summing/averaging used-percent across unrelated providers would not be
 * a meaningful number.
 */
export default function UsageTrendSection({ snapshot }: { snapshot: DashboardSnapshot | null }) {
  const { t, language } = useLocale();
  const hasCost = snapshot?.costContract?.origin === "providerReported" && snapshot.spendTrend.some(p => p.quantityKind === "spend" && p.measurementKind !== "unknown" && p.currencyCode && Number.isFinite(p.costUsed));
  const [metric, setMetric] = useState<Metric>("usage");
  const activeMetric = metric === "spend" && !hasCost ? "usage" : metric;

  const uiLocale = resolveIntlLocale(language);
  const fmt = useMemo(
    () => bucketFormatter(snapshot?.grain ?? "daily", snapshot?.timezone ?? "UTC", uiLocale),
    [snapshot?.grain, snapshot?.timezone, uiLocale],
  );

  const usageGroups = useMemo(
    () => groupByProvider(snapshot?.usageTrend ?? []),
    [snapshot?.usageTrend],
  );
  const spendGroups = useMemo(
    () => {
      const grouped = groupByProvider((snapshot?.spendTrend ?? []).filter(p => p.quantityKind === "spend" && p.measurementKind !== "unknown" && p.currencyCode && Number.isFinite(p.costUsed)));
      // A single chart must never silently combine different currencies or measurement kinds.
      for (const [key, points] of grouped) {
        if (new Set(points.map(p => `${p.currencyCode}:${p.measurementKind}`)).size !== 1) grouped.delete(key);
      }
      return grouped;
    },
    [snapshot?.spendTrend],
  );

  const groups = activeMetric === "usage" ? usageGroups : spendGroups;
  const hasAnyData = groups.size > 0;

  return (
    <section className="dashboard-analytics__trend" aria-label={t("DashboardUsageTrendTitle")}>
      <div className="dashboard-analytics__section-head">
        <h2>{t("DashboardUsageTrendTitle")}</h2>
        <div className="dashboard-analytics__metric-toggle" role="radiogroup" aria-label={t("DashboardUsageTrendTitle")}>
          <button
            type="button"
            role="radio"
            aria-checked={activeMetric === "usage"}
            className={`dashboard-analytics__metric-btn${activeMetric === "usage" ? " dashboard-analytics__metric-btn--active" : ""}`}
            onClick={() => setMetric("usage")}
          >
            {t("DashboardMetricUsage")}
          </button>
          {hasCost && (
            <button
              type="button"
              role="radio"
              aria-checked={activeMetric === "spend"}
              className={`dashboard-analytics__metric-btn${activeMetric === "spend" ? " dashboard-analytics__metric-btn--active" : ""}`}
              onClick={() => setMetric("spend")}
            >
              {t("DashboardMetricSpend")}
            </button>
          )}
        </div>
      </div>
      {!hasAnyData ? (
        <p className="dashboard-analytics__empty">
          {snapshot && snapshot.availability.sampleCount > 0
            ? t("DashboardTrendEmptyForRange")
            : t("DashboardCollectingHistory")}
        </p>
      ) : (
        <div className="dashboard-analytics__trend-grid">
          {[...groups.entries()].map(([key, points]) => {
            const [providerId] = key.split(":");
            const color =
              activeMetric === "usage" ? providerCreditsColor(providerId) : providerCostColor(providerId);
            const chartPoints: LineChartPoint[] = points.map((p) => ({
              label: fmt.format(new Date(p.bucketStart * 1000)),
              timestamp: p.bucketStart,
              value: activeMetric === "usage" ? (p as { usedPercent: number }).usedPercent : (p as { costUsed: number }).costUsed,
            }));
            return (
              <div className="dashboard-analytics__trend-item" key={key}>
                <span className="dashboard-analytics__trend-provider">{providerId}</span>
                <LineChart
                  data={chartPoints}
                  expectedStep={snapshot?.grain === "hourly" ? 3600 : 86400}
                  color={color}
                  ariaLabel={`${providerId} ${t(activeMetric === "usage" ? "DashboardMetricUsage" : "DashboardMetricSpend")}`}
                  valueFormatter={
                    activeMetric === "usage"
                      ? (n) => formatPercentage(n)
                      : (n) => `${n.toFixed(2)} ${spendGroups.get(key)?.[0]?.currencyCode ?? ""}`
                  }
                  maxLabel={t("ChartMaxValueLabel")}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
