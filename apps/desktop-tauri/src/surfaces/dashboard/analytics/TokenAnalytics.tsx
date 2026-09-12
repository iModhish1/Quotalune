import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { getCodexWorkspacesSnapshot, getProviderChartData } from '../../../lib/tauri';
import type { CodexWorkspacesUsageTotals, SettingsSnapshot } from '../../../types/bridge';
import { useLocale } from '../../../hooks/useLocale';
import { useAnalyticsSources } from '../../../hooks/useAnalyticsSources';
import { formatCompactTokens, formatExactTokens } from '../../../lib/analytics/formatTokens';
import { useDashboardStructureTheme } from './useDashboardStructureTheme';
import { activityBuckets } from './LocalActivity';
import type { ChartSpec } from '../../../components/analytics/charts/chartSpec';
const Chart = lazy(() => import('../../../components/analytics/charts/EChartsSurface'));

/** Per-provider token totals, kept honest to what each source actually
 *  reports (docs/validation/LOCAL_ACTIVITY_FIELD_MATRIX.md):
 *  - Codex's own workspace index (`getCodexWorkspacesSnapshot`) exposes a
 *    real input/cached/output/total breakdown plus a real model list.
 *  - Claude's chart-data bridge (`getProviderChartData`) exposes only a
 *    30-day total plus a top model -- there is no input/output/cache
 *    split at this layer.
 *  `breakdown` is `null` when only a total is available; the UI must show
 *  a "no breakdown" note rather than a set of zero-valued cards.
 *  `daily` (real per-day totals, both providers) backs the trend chart;
 *  there is no per-day input/output/cache split for either provider, so
 *  the chart tooltip shows Total only -- never a fabricated daily
 *  breakdown. `observedDays` counts days with real nonzero activity in
 *  the 30-day window, computed identically for both providers from the
 *  same `daily` array so the two numbers stay comparable. */
interface ProviderTokenTotals {
  total: number | null;
  breakdown: CodexWorkspacesUsageTotals | null;
  daily: { day: string; totalTokens: number }[];
  observedDays: number;
  modelCount: number | null;
  topModel: string | null;
}

async function loadCodexTotals(): Promise<ProviderTokenTotals> {
  const [snapshot, chart] = await Promise.all([
    getCodexWorkspacesSnapshot({ historyDays: 30 }),
    getProviderChartData('codex'),
  ]);
  const daily = chart.tokensHistory.map((p) => ({ day: p.date, totalTokens: p.tokens }));
  return {
    total: snapshot.total.totalTokens,
    breakdown: snapshot.total,
    daily,
    observedDays: daily.filter((p) => p.totalTokens > 0).length,
    modelCount: snapshot.modelTotals.length,
    topModel: chart.localUsage?.topModel ?? null,
  };
}

async function loadClaudeTotals(): Promise<ProviderTokenTotals> {
  const data = await getProviderChartData('claude');
  const daily = data.tokensHistory.map((p) => ({ day: p.date, totalTokens: p.tokens }));
  const total = data.localUsage?.thirtyDayTokens ?? daily.reduce((sum, p) => sum + p.totalTokens, 0);
  return {
    total,
    breakdown: null,
    daily,
    observedDays: daily.filter((p) => p.totalTokens > 0).length,
    modelCount: null,
    topModel: data.localUsage?.topModel ?? null,
  };
}

/** Analytics -> Tokens. Capability-gated (owner: never render a tab a
 *  currently-available source cannot back). When a single provider is
 *  selected, shows that provider's real cards + trend. When no provider
 *  is selected, shows both providers plus the shared-field comparison
 *  across every available token-capable source -- Total only, since
 *  Total is the only field both Codex and Claude actually report (spec:
 *  never compare incompatible fields as if equivalent). */
export default function TokenAnalytics({ settings, providerId, isDemo }: { settings: SettingsSnapshot; providerId: string | null; isDemo: boolean }) {
  const { t } = useLocale();
  const { sources } = useAnalyticsSources();
  const { theme } = useDashboardStructureTheme(settings);
  const [codex, setCodex] = useState<ProviderTokenTotals | null>(null);
  const [claude, setClaude] = useState<ProviderTokenTotals | null>(null);
  const [error, setError] = useState(false);
  const [mode, setMode] = useState<'daily' | 'weekly'>('daily');

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

  function tokenCell(labelKey: 'TokenCardTotal' | 'TokenCardInput' | 'TokenCardCached' | 'TokenCardOutput', value: number) {
    return <div className="analytics-comparison-stat"><dt>{t(labelKey)}</dt><dd title={formatExactTokens(value)}>{formatCompactTokens(value)}</dd></div>;
  }

  function providerTrendChart(sourceLabel: string, totals: ProviderTokenTotals) {
    const buckets = activityBuckets(totals.daily, mode);
    const text = theme.material?.text ?? '#f0f4f8', muted = theme.material?.muted ?? '#aeb9c5';
    const spec: ChartSpec = {
      label: `${sourceLabel} · ${t('TokenTrendHeading')}`,
      height: 220,
      points: buckets.length,
      empty: !buckets.length,
      option: {
        animation: false,
        // `aria.enabled: false` is deliberate (owner Phase 3N accessibility
        // closure): with no custom `aria.label.description`, ECharts' own
        // AriaComponent generated a verbose per-bar narration ("This is a
        // chart with type Bar chart named Codex. The first 10 items are:
        // the data for 2026-08-14 is 0, 2155839271, ...") that overwrote
        // this surface's real `role="img" aria-label={spec.label}`
        // (EChartsSurface.tsx) -- found via a native CDP accessibility
        // audit. `label` above (e.g. "Codex · Token trend") is already the
        // clean summary; disabling ECharts' own generator lets it stand.
        aria: { enabled: false },
        grid: { left: 60, right: 20, top: 20, bottom: 50 },
        tooltip: {
          trigger: 'axis',
          confine: true,
          backgroundColor: theme.core,
          borderColor: theme.coreEdge,
          textStyle: { color: text },
          formatter: (params: unknown) => {
            const [p] = (Array.isArray(params) ? params : [params]) as { axisValue?: string; value?: number }[];
            if (!p) return '';
            const value = Number(p.value ?? 0);
            return `<div><strong>${p.axisValue ?? ''}</strong><br/>${sourceLabel}<br/><small>${t('TokenScopeLocalDevice')}</small><br/>${t('TokenCardTotal')}: <b>${formatExactTokens(value)}</b></div>`;
          },
        },
        xAxis: { type: 'category', data: buckets.map((p) => p.day), axisLabel: { color: muted, hideOverlap: true } },
        yAxis: { type: 'value', min: 0, axisLabel: { color: muted, formatter: (v: number) => formatCompactTokens(v) }, splitLine: { lineStyle: { color: theme.hairline } } },
        series: [{ type: 'bar', name: sourceLabel, data: buckets.map((p) => p.tokens), itemStyle: { color: theme.accent, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 28 }],
      },
    };
    return buckets.length
      ? <Suspense fallback={<p>…</p>}><Chart spec={spec} unavailable={t('DashboardValueUnavailable')} /></Suspense>
      : <p className="analytics-empty">{t('DashboardValueUnavailable')}</p>;
  }

  function providerCard(sourceLabel: string, totals: ProviderTokenTotals | null) {
    if (!totals) return <section className="analytics-section token-analytics-provider" key={sourceLabel}><header><h3><bdi>{sourceLabel}</bdi></h3></header><p role="status">…</p></section>;
    return (
      <section className="analytics-section token-analytics-provider" key={sourceLabel}>
        <header><h3><bdi>{sourceLabel}</bdi></h3><small className="analytics-note">{t('TokenScopeLocalDevice')}</small></header>
        <dl className="analytics-metric-ribbon">
          {tokenCell('TokenCardTotal', totals.total ?? 0)}
          {totals.breakdown && tokenCell('TokenCardInput', totals.breakdown.inputTokens)}
          {totals.breakdown && tokenCell('TokenCardCached', totals.breakdown.cachedInputTokens)}
          {totals.breakdown && tokenCell('TokenCardOutput', totals.breakdown.outputTokens)}
          <div className="analytics-comparison-stat"><dt>{t('TokenCardObservedDays')}</dt><dd>{totals.observedDays}</dd></div>
          {totals.modelCount !== null && <div className="analytics-comparison-stat"><dt>{t('TokenCardModels')}</dt><dd>{totals.modelCount}</dd></div>}
          {totals.modelCount === null && totals.topModel && <div className="analytics-comparison-stat"><dt>{t('PanelTopModelPrefix')}</dt><dd className="analytics-comparison-stat--text"><bdi>{totals.topModel}</bdi></dd></div>}
        </dl>
        {!totals.breakdown && <small className="analytics-note">{t('TokenNoBreakdownNote')}</small>}
        {providerTrendChart(sourceLabel, totals)}
      </section>
    );
  }

  const hasChartData = (showCodex && codex?.daily.length) || (showClaude && claude?.daily.length);

  return (
    <section className="analytics-section token-analytics">
      <header><h2>{t('V3Tokens')}</h2><p>{t('V3TokensHelp')}</p></header>
      {isDemo && <p className="analytics-empty">{t('V3ActivityDemo')}</p>}
      {error && <p role="status">{t('DashboardValueUnavailable')}</p>}
      {!isDemo && hasChartData && (
        <nav className="v3-section-nav" aria-label={t('TokenTrendHeading')}>
          {(['daily', 'weekly'] as const).map((id) => (
            <button type="button" key={id} aria-pressed={mode === id} onClick={() => setMode(id)}>{t(id === 'daily' ? 'V3Daily' : 'V3Weekly')}</button>
          ))}
        </nav>
      )}
      {showCodex && providerCard('Codex', codex)}
      {showClaude && providerCard('Claude', claude)}
      {!providerId && showCodex && showClaude && codex && claude && (
        <section className="analytics-section token-analytics-compare">
          <header><h3>{t('TokenCompareHeading')}</h3></header>
          <dl className="analytics-metric-ribbon">
            <div className="analytics-comparison-stat"><dt>Codex</dt><dd title={formatExactTokens(codex.total ?? 0)}>{formatCompactTokens(codex.total ?? 0)}</dd></div>
            <div className="analytics-comparison-stat"><dt>Claude</dt><dd title={formatExactTokens(claude.total ?? 0)}>{formatCompactTokens(claude.total ?? 0)}</dd></div>
          </dl>
        </section>
      )}
    </section>
  );
}
