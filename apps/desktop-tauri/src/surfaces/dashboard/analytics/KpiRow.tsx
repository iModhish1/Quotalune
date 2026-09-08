import type { ReactNode } from "react";
import { useLocale } from "../../../hooks/useLocale";
import { formatPercentage } from "../../../design-system/percent";
import { useFormattedResetTime } from "../../../hooks/useFormattedResetTime";
import type { KpiValues } from "./dashboardSelectors";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  tone?: "default" | "warning" | "critical";
}

/** A primary KPI cell -- real, meaningful data, given full visual weight. */
function KpiCard({ label, value, tone = "default" }: KpiCardProps) {
  return (
    <div className={`dashboard-kpi dashboard-kpi--${tone}`}>
      <span className="dashboard-kpi__label">{label}</span>
      <strong className="dashboard-kpi__value">{value}</strong>
    </div>
  );
}

/**
 * A compact status chip for a metric with no real data yet (owner Phase
 * 3.5 section 6): "keep honesty, change presentation" -- an unavailable
 * metric still says so explicitly, but as a small inline chip rather than
 * a full-size card carrying the same visual mass as real data.
 */
function CompactKpi({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="dashboard-kpi-compact">
      <span className="dashboard-kpi-compact__label">{label}</span>
      <span className="dashboard-kpi-compact__value" aria-hidden="true">
        —
      </span>
      <span className="dashboard-kpi-compact__reason">{reason}</span>
    </div>
  );
}

function NextResetValue({ resetsAt, relative }: { resetsAt: string; relative: boolean }) {
  const formatted = useFormattedResetTime(resetsAt, null, relative, "reset");
  return <bdi>{formatted}</bdi>;
}

// Mirrors MenuCardDetails.tsx's formatCurrency (module-private there) --
// the reported-spend KPI must render in whatever real currency
// `costContract.currencyCode` proved, never a hardcoded "$" prefix (a
// real bug the old `$${amount.toFixed(2)}` had: it would mislabel a
// EUR/GBP/etc. provider-reported total as dollars).
const kpiCurrencyFormatters = new Map<string, Intl.NumberFormat>();
function formatKpiCurrency(amount: number, code: string): string {
  try {
    let formatter = kpiCurrencyFormatters.get(code);
    if (!formatter) {
      formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: code });
      kpiCurrencyFormatters.set(code, formatter);
    }
    return formatter.format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

/**
 * The KPI summary row (owner section 8/9, refined Phase 3.5 section 6).
 * Only renders metrics genuinely supported by real data -- a metric with
 * no data never shows a fabricated 0/100%. Real values get full-size
 * primary cards; unavailable metrics are demoted to a compact status
 * strip so four "not available" cards never carry the same visual mass
 * as the two real numbers (Active Providers, Alerts) sitting beside them.
 */
export default function KpiRow({
  kpis,
  resetTimeRelative,
}: {
  kpis: KpiValues;
  resetTimeRelative: boolean;
}) {
  const { t } = useLocale();

  const highestUsageValue = kpis.highestUsageProvider ? (
    // Provider name + percentage are an LTR-safe technical pairing (owner
    // section 16) -- isolate the whole value so it never reorders inside
    // an RTL sentence.
    <bdi>{`${kpis.highestUsageProvider.providerName} · ${formatPercentage(kpis.highestUsageProvider.usedPercent)}`}</bdi>
  ) : null;
  const nextResetValue = kpis.nextReset ? (
    <NextResetValue resetsAt={kpis.nextReset.resetsAt} relative={resetTimeRelative} />
  ) : null;
  const spendValue =
    kpis.reportedSpendTotal !== null && kpis.reportedSpendCurrency !== null
      ? formatKpiCurrency(kpis.reportedSpendTotal, kpis.reportedSpendCurrency)
      : null;

  const primary: KpiCardProps[] = [
    // Active Providers is always primary: even 0 is a meaningful, real
    // headline fact ("nothing is connected right now"), not an
    // "unavailable" state -- it always has visual weight.
    { label: t("DashboardKpiActiveProviders"), value: String(kpis.activeProviderCount) },
  ];
  const compact: { label: string; reason: string }[] = [];

  if (highestUsageValue) {
    primary.push({ label: t("DashboardKpiHighestUsage"), value: highestUsageValue });
  } else {
    compact.push({ label: t("DashboardKpiHighestUsage"), reason: t("DashboardValueUnavailable") });
  }

  if (nextResetValue) {
    primary.push({ label: t("DashboardKpiNextReset"), value: nextResetValue });
  } else {
    compact.push({ label: t("DashboardKpiNextReset"), reason: t("DashboardValueUnavailable") });
  }

  if (spendValue) {
    primary.push({ label: t("DashboardKpiEstimatedSpend"), value: spendValue });
  } else {
    compact.push({ label: t("DashboardKpiEstimatedSpend"), reason: t("DashboardDataStatusCostUnavailable") });
  }

  // Alerts: only earns a full primary card once there's something to act
  // on -- zero alerts is the expected quiet default, not a headline fact.
  if (kpis.alertCount > 0) {
    primary.push({ label: t("DashboardKpiAlerts"), value: String(kpis.alertCount), tone: "warning" });
  } else {
    compact.push({ label: t("DashboardKpiAlerts"), reason: "0" });
  }

  return (
    <section className="dashboard-analytics__kpis" aria-label={t("TabDashboard")}>
      <div className="dashboard-analytics__kpis-primary">
        {primary.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>
      {compact.length > 0 && (
        <div className="dashboard-analytics__kpis-compact">
          {compact.map((kpi) => (
            <CompactKpi key={kpi.label} label={kpi.label} reason={kpi.reason} />
          ))}
        </div>
      )}
    </section>
  );
}
