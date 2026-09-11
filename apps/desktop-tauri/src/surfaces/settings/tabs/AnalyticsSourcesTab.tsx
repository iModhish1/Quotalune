import { useLocale } from "../../../hooks/useLocale";
import { useAnalyticsSources } from "../../../hooks/useAnalyticsSources";
import type { AnalyticsAvailability, AnalyticsCapabilities, AnalyticsScope } from "../../../types/bridge";
import type { LocaleKey } from "../../../i18n/keys";
import "./AnalyticsSourcesTab.css";

const STATUS_KEY: Record<AnalyticsAvailability, LocaleKey> = {
  available: "AnalyticsSourceStatusAvailable",
  noDataYet: "AnalyticsSourceStatusNoDataYet",
  unsupported: "AnalyticsSourceStatusUnsupported",
};
const SCOPE_KEY: Record<AnalyticsScope, LocaleKey> = {
  account: "AnalyticsScopeAccount",
  provider: "AnalyticsScopeProvider",
  device: "AnalyticsScopeDevice",
};
const CAPABILITY_ORDER: { key: keyof AnalyticsCapabilities; labelKey: LocaleKey }[] = [
  { key: "quota", labelKey: "AnalyticsCapabilityQuota" },
  { key: "resets", labelKey: "AnalyticsCapabilityResets" },
  { key: "monetary", labelKey: "AnalyticsCapabilityMonetary" },
  { key: "tokens", labelKey: "AnalyticsCapabilityTokens" },
  { key: "models", labelKey: "AnalyticsCapabilityModels" },
  { key: "sessionCount", labelKey: "AnalyticsCapabilitySessions" },
  { key: "dailyActivity", labelKey: "AnalyticsCapabilityDailyActivity" },
];

/**
 * Settings -> Analytics -> Data Sources (owner section 3). Renders the
 * real analytics source registry (`get_analytics_source_registry`)
 * verbatim -- every label, scope, capability chip, and read/does-not-read
 * line comes straight from `rust/src/analytics_sources.rs`, not a
 * second, hand-maintained copy of the capability rules. Uninstalled
 * third-party tools (ccusage, OpenLIT, etc.) never appear here as rows --
 * the registry itself only has real Quotalis-native sources.
 */
export default function AnalyticsSourcesTab() {
  const { t } = useLocale();
  const { sources, loading, error } = useAnalyticsSources();

  return (
    <section className="settings-section analytics-sources-tab" aria-label={t("TabAnalyticsSources")}>
      <h3 className="settings-section__title">{t("TabAnalyticsSources")}</h3>
      <p className="settings-section__description">{t("AnalyticsSourcesHelp")}</p>

      {error && <p role="alert" className="analytics-sources-tab__error">{error}</p>}
      {loading && !error && <p role="status">…</p>}

      {!loading && !error && (
        <ul className="analytics-sources-tab__list">
          {sources.map((source) => (
            <li key={source.id} className="analytics-sources-tab__row" data-availability={source.availability}>
              <div className="analytics-sources-tab__row-header">
                <strong>{source.label}</strong>
                <span className={`analytics-sources-tab__status analytics-sources-tab__status--${source.availability}`}>
                  {t(STATUS_KEY[source.availability])}
                </span>
                <span className="analytics-sources-tab__scope">{t(SCOPE_KEY[source.scope])}</span>
              </div>
              <div className="analytics-sources-tab__chips">
                {CAPABILITY_ORDER.filter((c) => source.capabilities[c.key]).map((c) => (
                  <span key={c.key} className="analytics-sources-tab__chip">
                    {t(c.labelKey)}
                  </span>
                ))}
              </div>
              <dl className="analytics-sources-tab__privacy">
                <div>
                  <dt>{t("AnalyticsSourceReadsLabel")}</dt>
                  <dd>{source.reads}</dd>
                </div>
                <div>
                  <dt>{t("AnalyticsSourceDoesNotReadLabel")}</dt>
                  <dd>{source.doesNotRead}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
