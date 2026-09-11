import { useEffect, useState } from 'react';
import { useLocale } from '../../../hooks/useLocale';
import { useAnalyticsSources } from '../../../hooks/useAnalyticsSources';
import { getCodexWorkspacesSnapshot, getProviderChartData } from '../../../lib/tauri';
import { formatCompactTokens } from '../../../lib/analytics/formatTokens';
import { formatRelativeUpdated } from '../../../lib/relativeTime';
import { availableHistoryDays } from './dashboardSelectors';
import type { AnalyticsAvailability, AnalyticsScope, DashboardSnapshot, SettingsSnapshot } from '../../../types/bridge';
import type { LocaleKey } from '../../../i18n/keys';

// Mirrors AnalyticsSourcesTab.tsx's own status/scope grammar exactly --
// one shared vocabulary for "what does this source mean", not a second
// hand-maintained copy of the wording.
const SOURCE_STATUS_KEY: Record<AnalyticsAvailability, LocaleKey> = {
  available: 'AnalyticsSourceStatusAvailable',
  noDataYet: 'AnalyticsSourceStatusNoDataYet',
  unsupported: 'AnalyticsSourceStatusUnsupported',
};
const SOURCE_SCOPE_KEY: Record<AnalyticsScope, LocaleKey> = {
  account: 'AnalyticsScopeAccount',
  provider: 'AnalyticsScopeProvider',
  device: 'AnalyticsScopeDevice',
};

/** Analytics -> Overview: the DATA UNIVERSE summary (owner: "Analytics
 *  Overview is NOT Dashboard Overview... do not duplicate Dashboard
 *  cards"). Before this component, the Analytics Center's own "overview"
 *  section rendered the exact same operational KpiRow/TrendIntelligence/
 *  ProviderUsageMatrix as the Dashboard's Current Limits view -- real
 *  functionality, but not a distinct surface. This summarizes what
 *  Quotalis actually *knows*: how many sources are available, how much
 *  history exists, real observed token activity and models, and upcoming
 *  resets -- never a Session KPI (file-count proxy, not a real session),
 *  never a fabricated global quota percentage, never a locally-estimated
 *  dollar cost (permanently billing-channel-ineligible for local
 *  activity sources; see docs/validation/LOCAL_ACTIVITY_FIELD_MATRIX.md). */
export default function AnalyticsOverview({
  settings,
  snapshot,
  resetCount,
  isDemo,
}: {
  settings: SettingsSnapshot;
  snapshot: DashboardSnapshot | null;
  resetCount: number;
  isDemo: boolean;
}) {
  const { t } = useLocale();
  const { sources } = useAnalyticsSources();
  const [tokenTotal, setTokenTotal] = useState<number | null>(null);
  const [modelsObserved, setModelsObserved] = useState<number | null>(null);

  const availableSources = sources.filter((s) => s.availability === 'available');
  const localActivitySources = availableSources.filter(
    (s) => s.capabilities.dailyActivity || s.capabilities.tokens,
  );
  const codexAvailable = !isDemo && sources.some((s) => s.id === 'codexLocalActivity' && s.availability === 'available' && s.capabilities.tokens);
  const claudeAvailable = !isDemo && sources.some((s) => s.id === 'claudeLocalActivity' && s.availability === 'available' && s.capabilities.tokens);
  // Local device scanning (Claude in particular) can take several real
  // seconds on a large transcript corpus -- render a stable placeholder
  // cell immediately rather than silently omitting the Token/Model
  // columns until the scan resolves, which would otherwise reflow the
  // whole ribbon out from under the reader mid-glance.
  const tokenActivityPending = (codexAvailable || claudeAvailable) && tokenTotal === null;

  useEffect(() => {
    let cancelled = false;
    if (!codexAvailable && !claudeAvailable) {
      setTokenTotal(null);
      setModelsObserved(null);
      return;
    }
    (async () => {
      let total = 0;
      let models = 0;
      if (codexAvailable) {
        const snap = await getCodexWorkspacesSnapshot({ historyDays: 30 }).catch(() => null);
        if (snap) {
          total += snap.total.totalTokens;
          models += snap.modelTotals.length;
        }
      }
      if (claudeAvailable) {
        const chart = await getProviderChartData('claude').catch(() => null);
        if (chart?.localUsage?.thirtyDayTokens) total += chart.localUsage.thirtyDayTokens;
      }
      if (!cancelled) {
        setTokenTotal(total);
        setModelsObserved(models);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [codexAvailable, claudeAvailable]);

  const historyDays = snapshot ? availableHistoryDays(snapshot.availability) : 0;
  const lastSampleMs = snapshot?.availability.lastSampleAt ? snapshot.availability.lastSampleAt * 1000 : null;

  return (
    <section className="analytics-section analytics-overview-summary">
      <header>
        <h2>{t('V3AnalyticsOverviewTitle')}</h2>
        <p>{t('V3AnalyticsOverviewHelp')}</p>
      </header>
      {isDemo ? (
        <p className="analytics-empty">{t('V3ActivityDemo')}</p>
      ) : (
        <>
          <dl className="analytics-metric-ribbon analytics-overview-ribbon">
            <div className="analytics-comparison-stat">
              <dt>{t('OverviewAvailableSources')}</dt>
              <dd>{availableSources.length}/{sources.length}</dd>
            </div>
            <div className="analytics-comparison-stat">
              <dt>{t('OverviewHistorySpan')}</dt>
              {historyDays > 0 ? (
                <dd><bdi>{historyDays} <small>{t('OverviewDaysOfHistorySuffix')}</small></bdi></dd>
              ) : (
                <dd className="analytics-comparison-stat--text">{t('DashboardHistoryChipCollecting')}</dd>
              )}
            </div>
            <div className="analytics-comparison-stat">
              <dt>{t('OverviewLocalActivitySources')}</dt>
              <dd>{localActivitySources.length}</dd>
            </div>
            {tokenActivityPending && (
              <div className="analytics-comparison-stat analytics-comparison-stat--pending">
                <dt>{t('OverviewTokenActivity')}</dt>
                <dd aria-live="polite">{t('OverviewMeasuring')}</dd>
              </div>
            )}
            {tokenTotal !== null && (
              <div className="analytics-comparison-stat">
                <dt>{t('OverviewTokenActivity')}</dt>
                <dd title={tokenTotal.toLocaleString()}>{formatCompactTokens(tokenTotal)}</dd>
              </div>
            )}
            {modelsObserved !== null && modelsObserved > 0 && (
              <div className="analytics-comparison-stat">
                <dt>{t('OverviewModelsObserved')}</dt>
                <dd>{modelsObserved}</dd>
              </div>
            )}
            <div className="analytics-comparison-stat">
              <dt>{t('OverviewUpcomingResets')}</dt>
              <dd>{resetCount}</dd>
            </div>
            <div className="analytics-comparison-stat">
              <dt>{t('OverviewFreshness')}</dt>
              <dd className="analytics-comparison-stat--text"><bdi>{formatRelativeUpdated(lastSampleMs, t)}</bdi></dd>
            </div>
          </dl>
          <ul className="analytics-overview-sources" aria-label={t('OverviewSourcesHeading')}>
            {sources.map((source) => (
              <li key={source.id} className={`analytics-overview-source analytics-overview-source--${source.availability}`}>
                <span className="analytics-overview-source__dot" aria-hidden="true" />
                <div className="analytics-overview-source__body">
                  <strong>{source.label}</strong>
                  <span className="analytics-overview-source__meta">
                    {t(SOURCE_STATUS_KEY[source.availability])}
                    {' · '}
                    {t(SOURCE_SCOPE_KEY[source.scope])}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
