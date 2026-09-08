import { useLocale } from "../../../hooks/useLocale";
import { formatPercentage } from "../../../design-system/percent";
import { useFormattedResetTime } from "../../../hooks/useFormattedResetTime";
import type { KpiValues } from "./dashboardSelectors";

interface KpiCardProps {
  label: string;
  value: React.ReactNode | null;
  unavailableReason?: string;
  tone?: "default" | "warning" | "critical";
}

function KpiCard({ label, value, unavailableReason, tone = "default" }: KpiCardProps) {
  return (
    <div className={`dashboard-kpi dashboard-kpi--${tone}`}>
      <span className="dashboard-kpi__label">{label}</span>
      {value !== null ? (
        <strong className="dashboard-kpi__value">{value}</strong>
      ) : (
        <>
          <strong className="dashboard-kpi__value dashboard-kpi__value--empty" aria-hidden="true">
            —
          </strong>
          {unavailableReason && (
            <span className="dashboard-kpi__hint">{unavailableReason}</span>
          )}
        </>
      )}
    </div>
  );
}

function NextResetValue({ resetsAt, relative }: { resetsAt: string; relative: boolean }) {
  const formatted = useFormattedResetTime(resetsAt, null, relative, "reset");
  return <bdi>{formatted}</bdi>;
}

/**
 * The KPI summary row (owner section 8/9). Only renders metrics genuinely
 * supported by real data -- a metric with no data shows an explicit
 * unavailable state, never a fabricated 0/100%.
 */
export default function KpiRow({
  kpis,
  resetTimeRelative,
}: {
  kpis: KpiValues;
  resetTimeRelative: boolean;
}) {
  const { t } = useLocale();

  return (
    <section className="dashboard-analytics__kpis" aria-label={t("TabDashboard")}>
      <KpiCard
        label={t("DashboardKpiActiveProviders")}
        value={String(kpis.activeProviderCount)}
      />
      <KpiCard
        label={t("DashboardKpiHighestUsage")}
        value={
          kpis.highestUsageProvider ? (
            // Provider name + percentage are an LTR-safe technical pairing
            // (owner section 16) -- isolate the whole value so it never
            // reorders inside an RTL sentence.
            <bdi>{`${kpis.highestUsageProvider.providerName} · ${formatPercentage(kpis.highestUsageProvider.usedPercent)}`}</bdi>
          ) : null
        }
        unavailableReason={t("DashboardValueUnavailable")}
      />
      <KpiCard
        label={t("DashboardKpiNextReset")}
        value={
          kpis.nextReset ? (
            <NextResetValue resetsAt={kpis.nextReset.resetsAt} relative={resetTimeRelative} />
          ) : null
        }
        unavailableReason={t("DashboardValueUnavailable")}
      />
      <KpiCard
        label={t("DashboardKpiEstimatedSpend")}
        value={
          kpis.estimatedSpendTotal !== null ? `$${kpis.estimatedSpendTotal.toFixed(2)}` : null
        }
        unavailableReason={t("DashboardDataStatusCostUnavailable")}
      />
      <KpiCard
        label={t("DashboardKpiAlerts")}
        value={String(kpis.alertCount)}
        tone={kpis.alertCount > 0 ? "warning" : "default"}
      />
    </section>
  );
}
