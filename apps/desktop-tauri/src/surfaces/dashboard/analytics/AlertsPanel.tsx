import { useLocale } from "../../../hooks/useLocale";
import type { LocaleKey } from "../../../i18n/keys";
import { ProviderIcon } from "../../../components/providers/ProviderIcon";
import { buildAlerts, type DashboardAlert } from "./dashboardSelectors";
import type { ProviderUsageSnapshot, SettingsSnapshot } from "../../../types/bridge";

const ALERT_KEYS: Record<DashboardAlert["kind"], LocaleKey> = {
  quotaWarning: "DashboardAlertQuotaWarning",
  quotaCritical: "DashboardAlertQuotaCritical",
  resetSoon: "DashboardAlertResetSoon",
  authRequired: "DashboardAlertAuthRequired",
  unavailable: "DashboardAlertUnavailable",
};

/**
 * Splits a "{} ..." template on its single placeholder and wraps the
 * provider name in `<bdi>` (owner section 16: provider/model names stay
 * LTR-isolated inside an RTL sentence, never reversed). The surrounding
 * template text renders as plain text either side of it.
 */
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
 * Deterministic, local, rule-based alerts (owner section 22), doubling as
 * the "friendly provider errors" surface (owner section 10/20): an
 * auth-required alert reads "{provider} needs sign-in" with a Reconnect
 * action, never a raw OAuth/CLI diagnostic paragraph. No cloud/AI
 * involved -- `buildAlerts` is a pure function over real live provider
 * state and the user's own configured thresholds.
 */
export default function AlertsPanel({
  providers,
  settings,
  onOpenProviders,
  isDemo = false,
}: {
  providers: ProviderUsageSnapshot[];
  settings: Pick<SettingsSnapshot, "highUsageThreshold" | "criticalUsageThreshold">;
  onOpenProviders: () => void;
  /** Phase 5.2 owner section 20: a simulated auth-required/unavailable
   *  alert must never offer a real "Reconnect" action that would open
   *  the real Providers tab and imply a genuine OAuth/credential flow --
   *  its action is replaced with a disabled "Demo state" button instead. */
  isDemo?: boolean;
}) {
  const { t } = useLocale();
  const alerts = buildAlerts(providers, settings);

  return (
    <section
      className={`dashboard-analytics__alerts${alerts.length > 0 ? " dashboard-analytics__alerts--active" : ""}`}
      aria-label={t("DashboardAlertsTitle")}
    >
      <h2>{t("DashboardAlertsTitle")}</h2>
      {alerts.length === 0 ? (
        <p className="dashboard-analytics__empty">{t("DashboardAlertsEmpty")}</p>
      ) : (
        <ul className="dashboard-analytics__alerts-list">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className={`dashboard-analytics__alert dashboard-analytics__alert--${alert.severity}`}
            >
              <ProviderIcon providerId={alert.providerId} size={16} className="dashboard-analytics__alert-glyph" />
              <span className="dashboard-analytics__alert-text">
                {renderWithIsolatedProvider(t(ALERT_KEYS[alert.kind]), alert.providerName)}
              </span>
              {(alert.kind === "authRequired" || alert.kind === "unavailable") &&
                (isDemo ? (
                  <button type="button" className="dashboard-analytics__alert-action" disabled>
                    {t("DashboardDemoState")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="dashboard-analytics__alert-action"
                    onClick={onOpenProviders}
                  >
                    {t("DashboardReconnect")}
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
