import { useLocale } from "../../../hooks/useLocale";
import { providerCreditsColor } from "../../../components/charts/chartPalette";
import { formatPercentage } from "../../../design-system/percent";
import { rankProvidersByShare } from "./dashboardSelectors";
import type { DashboardProviderSummary } from "../../../types/bridge";

/**
 * Compact provider-distribution card (owner section 14): a ranked
 * horizontal-bar list, the cleanest low-overhead option compared to a
 * donut chart -- no new chart primitive needed, reuses the same color
 * palette as the trend chart. Renders only providers with real recorded
 * usage; never a single fabricated 100% slice for a lone provider (that
 * case is a real, correct 100% share -- `rankProvidersByShare` computes
 * it honestly rather than inventing a distribution among providers that
 * have no usage at all).
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
      {ranked.length === 0 ? (
        <p className="dashboard-analytics__empty">{t("DashboardDistributionEmpty")}</p>
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
