import { useLocale } from "../hooks/useLocale";
import { useFormattedResetTime } from "../hooks/useFormattedResetTime";
import { formatPercentage } from "../design-system/percent";
import { computeKpis } from "../surfaces/dashboard/analytics/dashboardSelectors";
import type { ProviderUsageSnapshot, SettingsSnapshot } from "../types/bridge";
import "./DashboardSummaryRibbon.css";

/**
 * A compact, typographic operational summary for the Dashboard Overview
 * (owner section 12/17: "replace generic KPI-card repetition ... use
 * typography + separators + small glyphs", "at a normal viewport the
 * first view should show ... at least one compact analytical summary").
 *
 * Reuses `computeKpis` -- the exact same selector the Analytics KPI row
 * already relies on -- rather than recomputing active/alert/reset logic a
 * second time; the only difference here is presentation (one thin
 * separator-joined line instead of a card grid) and that this surface has
 * no `DashboardSnapshot` to pass, so the spend figure this selector can
 * also produce is simply unused here, not fabricated.
 */
export default function DashboardSummaryRibbon({
  providers,
  settings,
}: {
  providers: ProviderUsageSnapshot[];
  settings: SettingsSnapshot;
}) {
  const { t } = useLocale();
  const kpis = computeKpis({ liveProviders: providers, snapshot: null, settings });
  const nextResetLabel = useFormattedResetTime(
    kpis.nextReset?.resetsAt ?? null,
    null,
    settings.resetTimeRelative,
    "reset",
  );

  const items: { label: string; value: string; tone?: "warning" }[] = [
    { label: t("DashboardKpiActiveProviders"), value: String(kpis.activeProviderCount) },
  ];
  if (kpis.alertCount > 0) {
    items.push({ label: t("DashboardKpiAlerts"), value: String(kpis.alertCount), tone: "warning" });
  }
  if (kpis.nextReset) {
    items.push({
      label: t("DashboardKpiNextReset"),
      value: `${kpis.nextReset.providerName} · ${nextResetLabel}`,
    });
  }
  if (kpis.highestUsageProvider) {
    items.push({
      label: t("DashboardKpiHighestUsage"),
      value: `${kpis.highestUsageProvider.providerName} · ${formatPercentage(kpis.highestUsageProvider.usedPercent)}`,
    });
  }

  // Every field above already has real data by construction (activeProviderCount
  // is always present; the others are only pushed when their KPI is non-null) --
  // nothing here is ever a fabricated placeholder for a metric with no data.
  if (items.length === 0) return null;

  return (
    <div className="dashboard-summary-ribbon" role="group" aria-label={t("TabDashboard")}>
      {items.map((item, index) => (
        <span
          className={`dashboard-summary-ribbon__item${item.tone ? ` dashboard-summary-ribbon__item--${item.tone}` : ""}`}
          key={item.label}
        >
          {index > 0 && <span className="dashboard-summary-ribbon__sep" aria-hidden="true" />}
          <span className="dashboard-summary-ribbon__label">{item.label}</span>
          <bdi className="dashboard-summary-ribbon__value">{item.value}</bdi>
        </span>
      ))}
    </div>
  );
}
