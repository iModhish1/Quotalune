import {describe, expect, it} from "vitest";
import type {QuotaHistoryPoint} from "../../types/bridge";
import {buildQuotaAnalytics, compareQuotaPeriods, quotaVelocity} from "./quotaAnalytics";
import {METRIC_REGISTRY} from "./metricRegistry";
const hour = 3600;
const range = {since: 4 * hour, until: 8 * hour, grainSeconds: hour};
function point(i: number, used = i * 5, overrides: Partial<QuotaHistoryPoint> = {}): QuotaHistoryPoint {
  return {provider: "codex", accountId: "observed:test", accountScope: "observed", windowKey: "primary:10080", windowLabel: "Weekly", windowMinutes: 10080,
    bucketStart: i * hour, observedAt: i * hour, usedPercent: used, remainingPercent: 100 - used, resetsAt: 10 * hour, sampleCount: 1, ...overrides};
}
const corpus = () => Array.from({length: 8}, (_, i) => point(i));
describe("physical quota analytics contracts", () => {
  it("honors raw integrity flags even when bucket-closing readings look monotonic", () => {
    const conflicting = corpus().map((p,i) => ({...p,hasConflictingSamples:i===6}));
    expect(buildQuotaAnalytics(conflicting,range)[0].comparison).toEqual({state:"error",value:null,reason:"invalidSamples"});
    const decreasing = corpus().map((p,i) => ({...p,counterDecreased:i===6}));
    expect(buildQuotaAnalytics(decreasing,range)[0].velocity).toEqual({state:"unavailable",value:null,reason:"counterDecrease"});
  });
  it("compares equal periods as percentage points of mean observations", () => {
    const model = buildQuotaAnalytics(corpus(), range)[0];
    expect(model.comparison).toEqual({state: "available", value: 20});
    expect(model.velocity).toEqual({state: "available", value: 5});
    expect(model.sampleCount).toBe(4);
  });
  it("rejects mixed accounts and windows, unknown account identity and missing durations", () => {
    const data = corpus();
    expect(compareQuotaPeriods(data.slice(4), data.slice(0, 4).map(p => ({...p, accountId: "another"})), range).value).toBeNull();
    for (const patch of [{accountScope: "legacy" as const}, {accountScope: "unresolved" as const}, {windowMinutes: null}, {windowKey: ""}]) {
      expect(buildQuotaAnalytics(data.map(p => ({...p, ...patch})), range)[0].comparison.value).toBeNull();
    }
  });
  it("never converts invalid percentages or conflicting duplicates to known zero", () => {
    for (const invalid of [-1, 101, NaN, Infinity]) {
      const model = buildQuotaAnalytics([...corpus(), point(6, invalid)], range)[0];
      expect(model.comparison.state).toBe("error");
      expect(model.mean.value).toBeNull();
    }
    expect(buildQuotaAnalytics([...corpus(), point(6, 99)], range)[0].invalid).toBe(true);
  });
  it("deduplicates identical observations and keeps real zero and 100", () => {
    expect(buildQuotaAnalytics([...corpus(), ...corpus()], range)[0].sampleCount).toBe(4);
    expect(buildQuotaAnalytics(corpus().map(p => ({...p, usedPercent: 0, remainingPercent: 100})), range)[0].mean.value).toBe(0);
    expect(buildQuotaAnalytics(corpus().map(p => ({...p, usedPercent: 100, remainingPercent: 0})), range)[0].mean.value).toBe(100);
  });
  it("does not derive velocity across reset boundaries or counter decreases", () => {
    const data = corpus().slice(4);
    expect(quotaVelocity(data.map((p, i) => ({...p, resetsAt: (i < 2 ? 10 : 20) * hour})), hour).reason).toBe("resetBoundary");
    expect(quotaVelocity(data.map(p => ({...p, resetsAt: null})), hour).value).toBeNull();
    expect(quotaVelocity(data.map((p, i) => ({...p, usedPercent: 80 - i * 10, remainingPercent: 20 + i * 10})), hour).reason).toBe("counterDecrease");
  });
  it("reports sparse or missing periods as insufficient history", () => {
    expect(buildQuotaAnalytics(corpus().slice(5), range)[0].comparison.state).toBe("insufficientHistory");
    expect(buildQuotaAnalytics(corpus(), {...range, until: 20 * hour})[0].comparison.value).toBeNull();
    expect(buildQuotaAnalytics([], range)).toEqual([]);
  });
  it("provider filters, themes and chart templates cannot mutate source semantics", () => {
    const data = [...corpus(), ...corpus().map(p => ({...p, provider: "claude"}))];
    const before = structuredClone(data);
    const all = buildQuotaAnalytics(data, range);
    expect(buildQuotaAnalytics(data, range, "codex")).toEqual(all.filter(p => p.provider === "codex"));
    expect(buildQuotaAnalytics([...data].reverse(), range)).toEqual(all);
    expect(data).toEqual(before);
    // Renderer/style choices are intentionally absent from aggregation input.
    for (const _style of ["precision", "minimal", "detailed"]) expect(buildQuotaAnalytics(data, range)).toEqual(all);
    expect(METRIC_REGISTRY.quotaVelocity.unit).toBe("percentagePointsPerHour");
    expect(METRIC_REGISTRY.balance.unit).toBe("currency");
    expect(METRIC_REGISTRY.credits.unit).toBe("credits");
  });
  it("partitions physical windows and observed accounts without mixing their values", () => {
    const data = [...corpus(), ...corpus().map(p => ({...p, windowKey: "secondary", windowMinutes: 300})), ...corpus().map(p => ({...p, accountId: "second"}))];
    expect(buildQuotaAnalytics(data, range)).toHaveLength(3);
  });
});
