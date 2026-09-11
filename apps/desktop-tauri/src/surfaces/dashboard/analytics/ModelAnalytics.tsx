import { useEffect, useState } from 'react';
import { getCodexWorkspacesSnapshot, getProviderChartData } from '../../../lib/tauri';
import type { CodexWorkspacesModelUsage, SettingsSnapshot } from '../../../types/bridge';
import { useLocale } from '../../../hooks/useLocale';
import { useAnalyticsSources } from '../../../hooks/useAnalyticsSources';
import { useDashboardStructureTheme } from './useDashboardStructureTheme';
import { formatRelativeUpdated } from '../../../lib/relativeTime';
import { formatCompactTokens, formatExactTokens } from '../../../lib/analytics/formatTokens';

const TOP_MODELS_SHOWN = 5;

/** Analytics -> Models. Capability-gated on `models`. Codex has a real,
 *  ranked per-model token breakdown (`ModelUsage[]`, rust/src/
 *  codex_workspaces); Claude's chart-data bridge exposes only a single
 *  "most-used model" guess (`localUsage.topModel`) with no per-model
 *  token split. Never merge the two into one fabricated ranked list --
 *  each provider's section shows exactly what its source can honestly
 *  back (docs/validation/LOCAL_ACTIVITY_FIELD_MATRIX.md). */
export default function ModelAnalytics({ settings, providerId, isDemo }: { settings: SettingsSnapshot; providerId: string | null; isDemo: boolean }) {
  const { t } = useLocale();
  const { sources } = useAnalyticsSources();
  const { theme } = useDashboardStructureTheme(settings);
  const [codexModels, setCodexModels] = useState<CodexWorkspacesModelUsage[] | null>(null);
  const [claudeTopModel, setClaudeTopModel] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState(false);

  const codexAvailable = !isDemo && sources.some((s) => s.id === 'codexLocalActivity' && s.availability === 'available' && s.capabilities.models);
  const claudeAvailable = !isDemo && sources.some((s) => s.id === 'claudeLocalActivity' && s.availability === 'available' && s.capabilities.models);
  const showCodex = codexAvailable && (!providerId || providerId === 'codex');
  const showClaude = claudeAvailable && (!providerId || providerId === 'claude');

  useEffect(() => {
    let cancelled = false;
    setError(false);
    if (showCodex) {
      getCodexWorkspacesSnapshot({ historyDays: 30 })
        .then((v) => { if (!cancelled) setCodexModels(v.modelTotals); })
        .catch(() => { if (!cancelled) setError(true); });
    } else {
      setCodexModels(null);
    }
    return () => { cancelled = true; };
  }, [showCodex]);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    if (showClaude) {
      getProviderChartData('claude')
        .then((v) => { if (!cancelled) setClaudeTopModel(v.localUsage?.topModel ?? null); })
        .catch(() => { if (!cancelled) setError(true); });
    } else {
      setClaudeTopModel(undefined);
    }
    return () => { cancelled = true; };
  }, [showClaude]);

  const codexTotal = (codexModels ?? []).reduce((sum, m) => sum + m.totalTokens, 0);

  return (
    <section className="analytics-section model-analytics">
      <header><h2>{t('V3Models')}</h2><p>{t('V3ModelsHelp')}</p></header>
      {isDemo && <p className="analytics-empty">{t('V3ActivityDemo')}</p>}
      {error && <p role="status">{t('DashboardValueUnavailable')}</p>}
      {showCodex && (
        codexModels === null ? <p role="status">…</p> : (
          <section className="analytics-section model-analytics-provider">
            <header><h3><bdi>Codex</bdi></h3></header>
            {codexModels.length === 0 ? <p role="status">{t('DashboardValueUnavailable')}</p> : (
              <>
              <ol className="model-analytics-ranked" aria-label={t('ModelColumnShare')}>
                {codexModels.slice(0, TOP_MODELS_SHOWN).map((m) => {
                  const share = codexTotal > 0 ? (m.totalTokens / codexTotal) * 100 : 0;
                  return (
                    <li key={m.model}>
                      <div className="model-analytics-ranked__row">
                        <bdi className="model-analytics-ranked__name">{m.model}</bdi>
                        <span className="model-analytics-ranked__value" title={formatExactTokens(m.totalTokens)}>{formatCompactTokens(m.totalTokens)} · {share.toFixed(1)}%</span>
                      </div>
                      <div className="model-analytics-ranked__track"><div className="model-analytics-ranked__bar" style={{ width: `${Math.max(share, share > 0 ? 1 : 0)}%`, background: theme.accent }} /></div>
                    </li>
                  );
                })}
              </ol>
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>{t('ModelColumnModel')}</th>
                    <th>{t('ModelColumnTokens')}</th>
                    <th>{t('ModelColumnShare')}</th>
                    <th>{t('ModelColumnLastObserved')}</th>
                  </tr>
                </thead>
                <tbody>
                  {codexModels.map((m) => (
                    <tr key={m.model}>
                      <td><bdi>{m.model}</bdi></td>
                      <td title={formatExactTokens(m.totalTokens)}>{formatCompactTokens(m.totalTokens)}</td>
                      <td>{codexTotal > 0 ? `${((m.totalTokens / codexTotal) * 100).toFixed(1)}%` : '—'}</td>
                      <td><bdi>{formatRelativeUpdated(m.lastObserved ? Date.parse(m.lastObserved) : null, t)}</bdi></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </>
            )}
          </section>
        )
      )}
      {showClaude && (
        <section className="analytics-section model-analytics-provider">
          <header><h3><bdi>Claude</bdi></h3></header>
          {claudeTopModel === undefined ? <p role="status">…</p> : claudeTopModel === null ? <p role="status">{t('DashboardValueUnavailable')}</p> : (
            <dl className="analytics-metric-ribbon">
              <div className="analytics-comparison-stat"><dt>{t('PanelTopModelPrefix')}</dt><dd className="analytics-comparison-stat--text"><bdi>{claudeTopModel}</bdi></dd></div>
            </dl>
          )}
          <small className="analytics-note">{t('ModelNoBreakdownNote')}</small>
        </section>
      )}
    </section>
  );
}
