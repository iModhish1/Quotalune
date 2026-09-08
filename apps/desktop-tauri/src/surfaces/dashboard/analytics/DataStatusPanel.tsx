import { useLocale } from "../../../hooks/useLocale";
import { resolveDataStatus } from "./dashboardSelectors";
import type { DashboardSnapshot } from "../../../types/bridge";

/**
 * Pricing/Data Status shell (owner section 26): honest state only --
 * never "pricing verified" or "all up to date" until the Phase 4 pricing
 * audit actually proves it, so `pricingState` from `resolveDataStatus` is
 * always "not yet verified" today. This widget exists to communicate
 * that honestly, not to imply completeness the app hasn't earned yet.
 */
export default function DataStatusPanel({ snapshot }: { snapshot: DashboardSnapshot | null }) {
  const { t } = useLocale();
  if (!snapshot) return null;
  const status = resolveDataStatus(snapshot.availability);
  const firstSample = snapshot.availability.firstSampleAt;

  return (
    <section className="dashboard-analytics__data-status" aria-label={t("DashboardDataStatusTitle")}>
      <h2>{t("DashboardDataStatusTitle")}</h2>
      <dl className="dashboard-analytics__data-status-list">
        <div className="dashboard-analytics__data-status-row">
          <dt>
            {t(
              status.historyState === "active"
                ? "DashboardDataStatusHistoryActive"
                : "DashboardDataStatusHistoryCollecting",
            )}
          </dt>
          <dd>
            {firstSample
              ? t("DashboardDataAvailableSince").replace(
                  "{}",
                  new Date(firstSample * 1000).toLocaleDateString(),
                )
              : "—"}
          </dd>
        </div>
        <div className="dashboard-analytics__data-status-row">
          <dt>{t("DashboardDataSamples").replace("{}", String(snapshot.availability.sampleCount))}</dt>
        </div>
        <div className="dashboard-analytics__data-status-row">
          <dt>
            {t(
              status.costState === "estimated"
                ? "DashboardDataStatusCostEstimated"
                : "DashboardDataStatusCostUnavailable",
            )}
          </dt>
        </div>
        <div className="dashboard-analytics__data-status-row">
          <dt>{t("DashboardDataStatusPricingNotVerified")}</dt>
        </div>
      </dl>
    </section>
  );
}
