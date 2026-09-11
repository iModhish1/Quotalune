import { useEffect, useState } from 'react';
import { getCodexWorkspacesSnapshot, getProviderChartData } from '../../../lib/tauri';
import type { CodexWorkspacesUsageTotals, SettingsSnapshot } from '../../../types/bridge';
import { useLocale } from '../../../hooks/useLocale';
import { useAnalyticsSources } from '../../../hooks/useAnalyticsSources';
import { formatCompactTokens, formatExactTokens } from '../../../lib/analytics/formatTokens';

/** Per-provider token totals, kept honest to what each source actually
 *  reports (docs/validation/LOCAL_ACTIVITY_FIELD_MATRIX.md):
 *  - Codex's own workspace index (`getCodexWorkspacesSnapshot`) exposes a
 *    real input/cached/output/total breakdown.
 *  - Claude's chart-data bridge (`getProviderChartData`) exposes only a
 *    30-day total -- there is no input/output/cache split at this layer.
 *  `breakdown` is `null` when only a total is available; the UI must show
 *  a "no breakdown" note rather than a set of zero-valued cards. */
interface ProviderTokenTotals {
  total: number | null;
  breakdown: CodexWorkspacesUsageTotals | null;
}

async function loadCodexTotals(): Promise<ProviderTokenTotals> {
  const snapshot = await getCodexWorkspacesSnapshot({ historyDays: 30 });
  return { total: snapshot.total.totalTokens, breakdown: snapshot.total };
}

async function loadClaudeTotals(): Promise<ProviderTokenTotals> {
  const data = await getProviderChartData('claude');
  const total = data.localUsage?.thirtyDayTokens ?? data.tokensHistory.reduce((sum, p) => sum + p.tokens, 0);
  return { total, breakdown: null };
}

/** Analytics -> Tokens. Capability-gated (owner: never render a tab a
 *  currently-available source cannot back). When a single provider is
 *  selected, shows that provider's real cards. When no provider is
 *  selected, shows the shared-field comparison across every available
 *  token-capable source -- Total only, since Total is the only field both
 *  Codex and Claude actually report (spec: never compare incompatible
 *  fields as if equivalent). */
export default function TokenAnalytics({ providerId, isDemo }: { settings: SettingsSnapshot; providerId: string | null; isDemo: boolean }) {
  const { t } = useLocale();
  const { sources } = useAnalyticsSources();
  const [codex, setCodex] = useState<ProviderTokenTotals | null>(null);
  const [claude, setClaude] = useState<ProviderTokenTotals | null>(null);
  const [error, setError] = useState(false);

  const codexAvailable = !isDemo && sources.some((s) => s.id === 'codexLocalActivity' && s.availability === 'available' && s.capabilities.tokens);
  const claudeAvailable = !isDemo && sources.some((s) => s.id === 'claudeLocalActivity' && s.availability === 'available' && s.capabilities.tokens);
  const showCodex = codexAvailable && (!providerId || providerId === 'codex');
  const showClaude = claudeAvailable && (!providerId || providerId === 'claude');

  useEffect(() => {
    let cancelled = false;
    setError(false);
    if (showCodex) {
      loadCodexTotals().then((v) => { if (!cancelled) setCodex(v); }).catch(() => { if (!cancelled) setError(true); });
    } else {
      setCodex(null);
    }
    return () => { cancelled = true; };
  }, [showCodex]);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    if (showClaude) {
      loadClaudeTotals().then((v) => { if (!cancelled) setClaude(v); }).catch(() => { if (!cancelled) setError(true); });
    } else {
      setClaude(null);
    }
    return () => { cancelled = true; };
  }, [showClaude]);

  function tokenCard(labelKey: 'TokenCardTotal' | 'TokenCardInput' | 'TokenCardCached' | 'TokenCardOutput', value: number) {
    return <div><dt>{t(labelKey)}</dt><dd title={formatExactTokens(value)}>{formatCompactTokens(value)}</dd></div>;
  }

  function providerCard(sourceLabel: string, totals: ProviderTokenTotals | null) {
    if (!totals) return <section className="analytics-section token-analytics-provider" key={sourceLabel}><header><h3><bdi>{sourceLabel}</bdi></h3></header><p role="status">…</p></section>;
    return (
      <section className="analytics-section token-analytics-provider" key={sourceLabel}>
        <header><h3><bdi>{sourceLabel}</bdi></h3></header>
        <dl className="analytics-metric-ribbon">
          {tokenCard('TokenCardTotal', totals.total ?? 0)}
          {totals.breakdown && tokenCard('TokenCardInput', totals.breakdown.inputTokens)}
          {totals.breakdown && tokenCard('TokenCardCached', totals.breakdown.cachedInputTokens)}
          {totals.breakdown && tokenCard('TokenCardOutput', totals.breakdown.outputTokens)}
        </dl>
        {!totals.breakdown && <small className="analytics-note">{t('TokenNoBreakdownNote')}</small>}
      </section>
    );
  }

  return (
    <section className="analytics-section token-analytics">
      <header><h2>{t('V3Tokens')}</h2><p>{t('V3TokensHelp')}</p></header>
      {isDemo && <p className="analytics-empty">{t('V3ActivityDemo')}</p>}
      {error && <p role="status">{t('DashboardValueUnavailable')}</p>}
      {showCodex && providerCard('Codex', codex)}
      {showClaude && providerCard('Claude', claude)}
      {!providerId && showCodex && showClaude && codex && claude && (
        <section className="analytics-section token-analytics-compare">
          <header><h3>{t('TokenCompareHeading')}</h3></header>
          <dl className="analytics-metric-ribbon">
            <div><dt>Codex</dt><dd title={formatExactTokens(codex.total ?? 0)}>{formatCompactTokens(codex.total ?? 0)}</dd></div>
            <div><dt>Claude</dt><dd title={formatExactTokens(claude.total ?? 0)}>{formatCompactTokens(claude.total ?? 0)}</dd></div>
          </dl>
        </section>
      )}
    </section>
  );
}
