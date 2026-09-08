import { useLocale } from "../../../hooks/useLocale";
import { providerCreditsColor } from "../../../components/charts/chartPalette";
import { formatPercentage } from "../../../design-system/percent";
import { rankProvidersByShare } from "./dashboardSelectors";
import type { DashboardProviderSummary } from "../../../types/bridge";

/** Splits a "{} ..." template on its placeholder and isolates the provider
 *  name in <bdi> -- same pattern as AlertsPanel's provider-name isolation. */
function renderWithIsolatedProvider(template: string, providerName: string) {
  const [before, after] = template.split("{}");
  return (
    <>
      {before}
      <bdi>{providerName}</bdi>
      {after}
    </>
  );
}

/**
 * Historical usage-share card (owner Phase 3.5 section 7/17): explicitly
 * framed as "share of usage in the SELECTED RANGE" -- not live provider
 * connectivity -- since this can legitimately show 100% for one provider
 * while "Active Providers" (a live, current-state KPI) reads 0 if that
 * provider currently needs re-auth. Both facts are honest; they answer
 * different questions, so the copy says which one this is.
 *
 * Adaptive (section 17): a single provider's share is 100% by definition,
 * so a full bar carries no comparative information -- render a compact
 * one-line statement instead. Multiple providers get the full ranked
 * bar list.
 */
export default function ProviderDistribution({
  providers,
}: {
  providers: DashboardProviderSummary[];
}) {
  const { t } = useLocale();
  const ranked = rankProvidersByShare(providers);

  return (
    <section
      className="dashboard-analytics__distribution"
      aria-label={t("DashboardDistributionTitle")}
    >
      <h2>{t("DashboardDistributionTitle")}</h2>
      <p className="dashboard-analytics__caption">{t("DashboardDistributionCaption")}</p>
      {ranked.length === 0 ? (
        <p className="dashboard-analytics__empty dashboard-analytics__empty--compact">
          {t("DashboardDistributionEmpty")}
        </p>
      ) : ranked.length === 1 ? (
        <p className="dashboard-analytics__distribution-solo">
          {renderWithIsolatedProvider(t("DashboardDistributionSoloAll"), ranked[0].provider)}
        </p>
      ) : (
        <ul className="dashboard-analytics__distribution-list">
          {ranked.map((entry) => (
            <li key={`${entry.provider}:${entry.accountId}`} className="dashboard-analytics__distribution-row">
              <span className="dashboard-analytics__distribution-name">
                <bdi>{entry.provider}</bdi>
              </span>
              <div className="dashboard-analytics__distribution-bar-track">
                <div
                  className="dashboard-analytics__distribution-bar-fill"
                  style={{
                    width: `${Math.max(2, entry.share * 100)}%`,
                    backgroundColor: providerCreditsColor(entry.provider),
                  }}
                />
              </div>
              <span className="dashboard-analytics__distribution-value">
                <bdi>{formatPercentage(entry.share * 100)}</bdi>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
