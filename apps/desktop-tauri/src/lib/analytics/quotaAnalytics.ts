import type {QuotaHistoryPoint} from "../../types/bridge";
import {missingMetric, type MetricResult} from "./metricRegistry";

export interface AnalyticsRange {since: number; until: number; grainSeconds: number;}
export interface QuotaSeries {
  key: string; provider: string; accountId: string; accountScope: QuotaHistoryPoint["accountScope"];
  windowKey: string; windowLabel: string | null; windowMinutes: number | null;
  current: QuotaHistoryPoint[]; previous: QuotaHistoryPoint[];
  invalid: boolean; comparison: MetricResult; velocity: MetricResult;
  minimum: MetricResult; maximum: MetricResult; mean: MetricResult;
  start: MetricResult; end: MetricResult; change: MetricResult; missingBucketCount: number;
  sampleCount: number; bucketCount: number; firstObservedAt: number | null; lastObservedAt: number | null;
  maxGapSeconds: number | null;
}
export const quotaSeriesKey = (point: QuotaHistoryPoint): string => JSON.stringify([point.provider, point.accountId, point.accountScope, point.windowKey, point.windowMinutes]);
const valid = (p: QuotaHistoryPoint) => !p.hasConflictingSamples && Number.isFinite(p.usedPercent) && p.usedPercent >= 0 && p.usedPercent <= 100
  && Number.isFinite(p.remainingPercent) && p.remainingPercent >= 0 && p.remainingPercent <= 100
  && Math.abs(p.usedPercent + p.remainingPercent - 100) <= 0.1
  && Number.isFinite(p.bucketStart) && Number.isFinite(p.observedAt) && p.observedAt >= p.bucketStart
  && Number.isInteger(p.sampleCount) && p.sampleCount > 0;
const mean = (points: QuotaHistoryPoint[]) => {
  const closing = new Map<number,QuotaHistoryPoint>();
  for(const point of points) {
    const previous=closing.get(point.bucketStart);
    if(!previous || point.observedAt>previous.observedAt) closing.set(point.bucketStart,point);
  }
  return [...closing.values()].reduce((sum,point)=>sum+point.usedPercent,0)/closing.size;
};
const available = (value: number): MetricResult => ({state: "available", value});
/**
 * `buildQuotaAnalytics` has already partitioned its input by this exact key.
 * Passing it through avoids serialising every point again for each derived
 * metric, while direct callers still receive the full identity check.
 */
function identityGuard(points: QuotaHistoryPoint[], groupedSeriesKey?: string): MetricResult | null {
  if (!points.length) return missingMetric("insufficientHistory", "insufficientSamples");
  if (points.some(p => p.accountScope !== "observed" || !p.accountId)) return missingMetric("unsupported", "identityUnknown");
  if (groupedSeriesKey === undefined) {
    const key = quotaSeriesKey(points[0]);
    if (points.some(p => quotaSeriesKey(p) !== key)) return missingMetric("unsupported", "identityUnknown");
  }
  if (!points[0].windowKey || !Number.isFinite(points[0].windowMinutes) || (points[0].windowMinutes ?? 0) <= 0) return missingMetric("unsupported", "windowUnknown");
  if (points.some(p => !valid(p))) return missingMetric("error", "invalidSamples");
  return null;
}
function maximumGap(points: QuotaHistoryPoint[]): number | null {
  if (points.length < 2) return null;
  let gap = 0;
  for (let i = 1; i < points.length; i++) gap = Math.max(gap, points[i].observedAt - points[i - 1].observedAt);
  return gap;
}

/** Same physical series and equal elapsed ranges. Compares sampled quota state,
 * not consumption, token rate or forecast. Policy is explicit in Metric Registry. */
export function compareQuotaPeriods(current: QuotaHistoryPoint[], previous: QuotaHistoryPoint[], range: AnalyticsRange): MetricResult {
  return compareQuotaPeriodsForSeries(current, previous, range);
}
function compareQuotaPeriodsForSeries(current: QuotaHistoryPoint[], previous: QuotaHistoryPoint[], range: AnalyticsRange, groupedSeriesKey?: string): MetricResult {
  const guard = identityGuard([...previous, ...current], groupedSeriesKey);
  if (guard) return guard;
  const span = range.until - range.since;
  if (!(span > 0) || !(range.grainSeconds > 0)) return missingMetric("error", "invalidSamples");
  for (const [points, since, until] of [[current, range.since, range.until], [previous, range.since - span, range.since]] as const) {
    const sorted = [...points].sort((a, b) => a.observedAt - b.observedAt);
    if (new Set(points.map(p => p.bucketStart)).size !== points.length || points.length < 4) return missingMetric("insufficientHistory", "insufficientSamples");
    if (points.some(p => p.observedAt < since || p.observedAt >= until)) return missingMetric("error", "invalidSamples");
    // Span is temporal sampling support, not a fictional provider refresh coverage %.
    if (sorted[0].observedAt - since > Math.max(range.grainSeconds, span * 0.1)
      || until - sorted[sorted.length - 1].observedAt > Math.max(range.grainSeconds, span * 0.1)
      || (maximumGap(sorted) ?? Infinity) > range.grainSeconds * 2) return missingMetric("insufficientHistory", "historyGap");
  }
  return available(mean(current) - mean(previous));
}

export function quotaVelocity(points: QuotaHistoryPoint[], grainSeconds: number): MetricResult {
  return quotaVelocityForSeries(points, grainSeconds);
}
function quotaVelocityForSeries(points: QuotaHistoryPoint[], grainSeconds: number, groupedSeriesKey?: string): MetricResult {
  const guard = identityGuard(points, groupedSeriesKey);
  if (guard) return guard;
  if (points.some(point => point.counterDecreased)) return missingMetric("unavailable", "counterDecrease");
  const sorted = [...points].sort((a, b) => a.observedAt - b.observedAt);
  if (points.length < 4 || new Set(points.map(p => p.observedAt)).size !== points.length) return missingMetric("insufficientHistory", "insufficientSamples");
  const reset = sorted[0].resetsAt;
  if (reset === null || !Number.isFinite(reset) || sorted.some(p => p.resetsAt !== reset || p.observedAt >= reset)) return missingMetric("unsupported", "resetBoundary");
  if ((maximumGap(sorted) ?? Infinity) > grainSeconds * 2) return missingMetric("insufficientHistory", "historyGap");
  if (sorted.some((p, i) => i > 0 && p.usedPercent < sorted[i - 1].usedPercent)) return missingMetric("unavailable", "counterDecrease");
  const elapsed = sorted[sorted.length - 1].observedAt - sorted[0].observedAt;
  if (elapsed < 3600) return missingMetric("insufficientHistory", "insufficientSamples");
  return available((sorted[sorted.length - 1].usedPercent - sorted[0].usedPercent) / (elapsed / 3600));
}

/** One grouping pass for the entire dashboard; renderers consume this model.
 * Duplicate source timestamps with conflicting values poison the series, never
 * silently choose whichever happens to appear last in the input. */
export function buildQuotaAnalytics(points: readonly QuotaHistoryPoint[], range: AnalyticsRange, providerFilter?: string | null): QuotaSeries[] {
  const groups = new Map<string, QuotaHistoryPoint[]>();
  const start = range.since - (range.until - range.since);
  for (const point of points) {
    if ((providerFilter && point.provider !== providerFilter) || point.observedAt < start || point.observedAt >= range.until) continue;
    const key = quotaSeriesKey(point);
    const group = groups.get(key);
    if (group) group.push(point); else groups.set(key, [point]);
  }
  return [...groups].map(([key, raw]) => {
    const seen = new Map<number, QuotaHistoryPoint>();
    let invalid = false;
    for (const p of raw) {
      if (!valid(p)) invalid = true;
      const old = seen.get(p.observedAt);
      if (old && (old.usedPercent !== p.usedPercent || old.remainingPercent !== p.remainingPercent || old.resetsAt !== p.resetsAt || old.sampleCount !== p.sampleCount)) invalid = true;
      if (!old) seen.set(p.observedAt, p);
      else if (p.counterDecreased && !old.counterDecreased) seen.set(p.observedAt, {...old,counterDecreased:true});
    }
    const sorted = [...seen.values()].sort((a, b) => a.observedAt - b.observedAt);
    const first = sorted[0];
    const current = sorted.filter(p => p.observedAt >= range.since);
    const previous = sorted.filter(p => p.observedAt < range.since);
    const error = invalid ? missingMetric("error", "invalidSamples") : null;
    const statsGuard = error ?? identityGuard(current, key);
    return {
      key, provider: first.provider, accountId: first.accountId, accountScope: first.accountScope,
      windowKey: first.windowKey, windowLabel: first.windowLabel, windowMinutes: first.windowMinutes,
      current, previous, invalid,
      comparison: error ?? compareQuotaPeriodsForSeries(current, previous, range, key),
      velocity: error ?? quotaVelocityForSeries(current, range.grainSeconds, key),
      start: statsGuard ?? available(current[0]?.usedPercent ?? NaN),
      end: statsGuard ?? available(current[current.length - 1]?.usedPercent ?? NaN),
      change: statsGuard ?? available((current[current.length - 1]?.usedPercent ?? NaN) - (current[0]?.usedPercent ?? NaN)),
      missingBucketCount: current.reduce((count,p,i) => count + (i ? Math.max(0,Math.round((p.bucketStart-current[i-1].bucketStart)/range.grainSeconds)-1) : 0),0),
      minimum: statsGuard ?? available(current.reduce((min, p) => Math.min(min, p.usedPercent), Infinity)),
      maximum: statsGuard ?? available(current.reduce((max, p) => Math.max(max, p.usedPercent), -Infinity)),
      mean: statsGuard ?? available(mean(current)),
      sampleCount: invalid ? 0 : current.reduce((sum, p) => sum + (valid(p) ? p.sampleCount : 0), 0),
      bucketCount: new Set(current.map(p => p.bucketStart)).size,
      firstObservedAt: current[0]?.observedAt ?? null,
      lastObservedAt: current[current.length - 1]?.observedAt ?? null,
      maxGapSeconds: maximumGap(current),
    };
  }).sort((a, b) => a.key.localeCompare(b.key));
}
