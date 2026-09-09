import type {LocaleKey} from "../../i18n/keys";
/** Analytics contracts, independent of React, theme, chart style and provider branding. */
export type MetricAvailability = "available" | "partial" | "insufficientHistory" | "unsupported" | "stale" | "unavailable" | "error";
export type MetricUnit = "percent" | "percentagePoints" | "percentagePointsPerHour" | "currency" | "credits" | "count" | "timestamp" | "tokens" | "seconds" | "state";
export type MetricId = "quotaUsed" | "quotaRemaining" | "quotaMean" | "quotaComparison" | "quotaVelocity" | "reportedSpend" | "balance" | "credits" | "historySamples" | "nextReset" | "quotaStart" | "quotaEnd" | "quotaChange" | "quotaMinimum" | "quotaPeak" | "highestQuota" | "reportingProviders" | "attentionCount" | "readingAge" | "historyGapBuckets" | "localTokens" | "localConversations" | "localRequests" | "hourlyActivity" | "priceCoverage" | "localEstimatedSpend" | "dailyProviderCredits" | "legacyUsageTrend" | "legacyPace";
export interface MetricDefinition {
  id: MetricId; label: string; description: string; unit: MetricUnit;
  scope: string; measurementKind: string; aggregation: string; comparison: string;
  requires: readonly string[]; provenance: string; resetBehavior: string;
  format: "percent" | "signedPoints" | "rate" | "money" | "units" | "integer" | "reset";
  visualizations: readonly string[];
}
const quota = {scope: "provider/observed-account/physical-window", measurementKind: "pointInTime", provenance: "provider observation", resetBehavior: "cycle endpoint is identity for rate calculations"};
const DEFINITIONS = {
  quotaUsed: {...quota, id: "quotaUsed", label: "Used quota", description: "Current independent quota observation", unit: "percent", aggregation: "latest; never summed across providers", comparison: "none", requires: ["ready", "finite 0..100"], format: "percent", visualizations: ["gauge", "bar", "matrix"]},
  quotaRemaining: {...quota, id: "quotaRemaining", label: "Remaining quota", description: "Provider-reported remaining quota", unit: "percent", aggregation: "latest", comparison: "none", requires: ["ready", "finite 0..100"], format: "percent", visualizations: ["gauge", "bar", "matrix"]},
  quotaMean: {...quota, id: "quotaMean", label: "Mean observed quota", description: "Arithmetic mean of bucket-close observations; not quota consumed", unit: "percent", aggregation: "one physical series; equal bucket grain", comparison: "mean observation difference", requires: ["observed account", "stable window", "valid buckets"], format: "percent", visualizations: ["stat", "table"]},
  quotaComparison: {...quota, id: "quotaComparison", label: "Period comparison", description: "Difference in mean observed quota, in percentage points", unit: "percentagePoints", aggregation: "current mean minus preceding comparable mean", comparison: "equal elapsed periods; same bucket grain and physical series", requires: ["4+ distinct buckets each", "observed account", "known equal duration", "80% temporal span", "no large gaps", "valid samples"], format: "signedPoints", visualizations: ["comparison", "table"]},
  quotaVelocity: {...quota, id: "quotaVelocity", label: "Usage velocity", description: "Observed percentage-point change per elapsed hour; not tokens or a forecast", unit: "percentagePointsPerHour", aggregation: "last minus first / elapsed hours", comparison: "none", requires: ["4+ distinct observations", "same reset endpoint", "monotonic quota", "observed account", "known window duration", "no large gaps"], format: "rate", visualizations: ["stat", "sparkline"]},
  reportedSpend: {id: "reportedSpend", label: "Reported Spend", description: "Actual reported monetary readings, not local price estimates", unit: "currency", scope: "provider/account/billing-period/currency", measurementKind: "contract-defined", aggregation: "cumulative latest per compatible series; delta only if proven", comparison: "only matching period and currency", requires: ["Spend quantity", "known measurement kind", "currency", "period"], provenance: "provider reported", resetBehavior: "billing-period boundary", format: "money", visualizations: ["stat", "table", "trend"]},
  balance: {id: "balance", label: "Balance", description: "Current provider balance; never spend", unit: "currency", scope: "provider/account/current/currency", measurementKind: "pointInTime", aggregation: "latest", comparison: "none", requires: ["Balance quantity", "currency"], provenance: "provider reported", resetBehavior: "none inferred", format: "money", visualizations: ["stat", "table"]},
  credits: {id: "credits", label: "Credits", description: "Provider-defined units; never currency", unit: "credits", scope: "provider/account/current", measurementKind: "pointInTime", aggregation: "latest", comparison: "same unit only", requires: ["Credits quantity"], provenance: "provider reported", resetBehavior: "provider contract", format: "units", visualizations: ["stat", "table"]},
  historySamples: {id: "historySamples", label: "Observed samples", description: "Selected-range physical-window observations, not days of complete coverage", unit: "count", scope: "provider/account/window/range", measurementKind: "count", aggregation: "sum distinct bucket sample counts", comparison: "none", requires: ["observations"], provenance: "local history", resetBehavior: "none", format: "integer", visualizations: ["coverage"]},
  nextReset: {id: "nextReset", label: "Next reset", description: "Earliest real future reset per physical window", unit: "timestamp", scope: "provider/window/current", measurementKind: "instant", aggregation: "minimum future instant", comparison: "time distance", requires: ["ready", "parseable future timestamp"], provenance: "provider reported", resetBehavior: "explicit instant", format: "reset", visualizations: ["timeline", "table"]},
  quotaStart: {id:"quotaStart",label:"Quota start",description:"first observed bucket",unit:"percent",scope:"provider/observed-account/physical-window/range",measurementKind:"pointInTime",aggregation:"first observed bucket",comparison:"same semantic source only; no cross-provider aggregation",requires:["valid source observations","explicit scope","known quantity and unit"],provenance:"source contract documented in QUOTALIS_METRIC_REGISTRY_AUDIT.md",resetBehavior:"preserve source window/period boundaries",format:"percent",visualizations:["table","stat"]},
  quotaEnd: {id:"quotaEnd",label:"Quota end",description:"last observed bucket",unit:"percent",scope:"provider/observed-account/physical-window/range",measurementKind:"pointInTime",aggregation:"last observed bucket",comparison:"same semantic source only; no cross-provider aggregation",requires:["valid source observations","explicit scope","known quantity and unit"],provenance:"source contract documented in QUOTALIS_METRIC_REGISTRY_AUDIT.md",resetBehavior:"preserve source window/period boundaries",format:"percent",visualizations:["table","stat"]},
  quotaChange: {id:"quotaChange",label:"Quota change",description:"last minus first; not consumption",unit:"percentagePoints",scope:"provider/observed-account/physical-window/range",measurementKind:"observedStateDifference",aggregation:"last minus first; not consumption",comparison:"same semantic source only; no cross-provider aggregation",requires:["valid source observations","explicit scope","known quantity and unit"],provenance:"source contract documented in QUOTALIS_METRIC_REGISTRY_AUDIT.md",resetBehavior:"preserve source window/period boundaries",format:"signedPoints",visualizations:["table","stat"]},
  quotaMinimum: {id:"quotaMinimum",label:"Quota minimum",description:"minimum observed bucket; not continuous minimum",unit:"percent",scope:"provider/observed-account/physical-window/range",measurementKind:"observedExtremum",aggregation:"minimum observed bucket; not continuous minimum",comparison:"same semantic source only; no cross-provider aggregation",requires:["valid source observations","explicit scope","known quantity and unit"],provenance:"source contract documented in QUOTALIS_METRIC_REGISTRY_AUDIT.md",resetBehavior:"preserve source window/period boundaries",format:"percent",visualizations:["table","stat"]},
  quotaPeak: {id:"quotaPeak",label:"Quota peak",description:"maximum observed bucket; not continuous peak",unit:"percent",scope:"provider/observed-account/physical-window/range",measurementKind:"observedExtremum",aggregation:"maximum observed bucket; not continuous peak",comparison:"same semantic source only; no cross-provider aggregation",requires:["valid source observations","explicit scope","known quantity and unit"],provenance:"source contract documented in QUOTALIS_METRIC_REGISTRY_AUDIT.md",resetBehavior:"preserve source window/period boundaries",format:"percent",visualizations:["table","stat"]},
  highestQuota: {id:"highestQuota",label:"Highest quota",description:"maximum valid physical-window percentage; independent denominators",unit:"percent",scope:"provider/current physical windows",measurementKind:"pointInTimeMaximum",aggregation:"maximum valid physical-window percentage; independent denominators",comparison:"same semantic source only; no cross-provider aggregation",requires:["valid source observations","explicit scope","known quantity and unit"],provenance:"source contract documented in QUOTALIS_METRIC_REGISTRY_AUDIT.md",resetBehavior:"preserve source window/period boundaries",format:"percent",visualizations:["table","stat"]},
  reportingProviders: {id:"reportingProviders",label:"Reporting providers",description:"count ready provider snapshots",unit:"count",scope:"current provider collection",measurementKind:"count",aggregation:"count ready provider snapshots",comparison:"same semantic source only; no cross-provider aggregation",requires:["valid source observations","explicit scope","known quantity and unit"],provenance:"source contract documented in QUOTALIS_METRIC_REGISTRY_AUDIT.md",resetBehavior:"preserve source window/period boundaries",format:"integer",visualizations:["table","stat"]},
  attentionCount: {id:"attentionCount",label:"Attention count",description:"count deterministic categorical issues",unit:"count",scope:"current provider collection",measurementKind:"count",aggregation:"count deterministic categorical issues",comparison:"same semantic source only; no cross-provider aggregation",requires:["valid source observations","explicit scope","known quantity and unit"],provenance:"source contract documented in QUOTALIS_METRIC_REGISTRY_AUDIT.md",resetBehavior:"preserve source window/period boundaries",format:"integer",visualizations:["table","stat"]},
  readingAge: {id:"readingAge",label:"Reading age",description:"elapsed seconds since valid snapshot timestamp",unit:"seconds",scope:"provider/current snapshot",measurementKind:"elapsedTime",aggregation:"elapsed seconds since valid snapshot timestamp",comparison:"same semantic source only; no cross-provider aggregation",requires:["valid source observations","explicit scope","known quantity and unit"],provenance:"source contract documented in QUOTALIS_METRIC_REGISTRY_AUDIT.md",resetBehavior:"preserve source window/period boundaries",format:"integer",visualizations:["table","stat"]},
  historyGapBuckets: {id:"historyGapBuckets",label:"History gap buckets",description:"missing interior buckets at query grain; no completeness percentage",unit:"count",scope:"provider/account/physical-window/range",measurementKind:"missingBucketCount",aggregation:"missing interior buckets at query grain; no completeness percentage",comparison:"same semantic source only; no cross-provider aggregation",requires:["valid source observations","explicit scope","known quantity and unit"],provenance:"source contract documented in QUOTALIS_METRIC_REGISTRY_AUDIT.md",resetBehavior:"preserve source window/period boundaries",format:"integer",visualizations:["table","stat"]},
  localTokens: {id:"localTokens",label:"Local tokens",description:"sum source token records; exclude duplicates",unit:"tokens",scope:"provider/local scan/range",measurementKind:"tokenCount",aggregation:"sum source token records; exclude duplicates",comparison:"same semantic source only; no cross-provider aggregation",requires:["valid source observations","explicit scope","known quantity and unit"],provenance:"source contract documented in QUOTALIS_METRIC_REGISTRY_AUDIT.md",resetBehavior:"preserve source window/period boundaries",format:"integer",visualizations:["table","stat"]},
  localConversations: {id:"localConversations",label:"Local conversations",description:"count observed source conversations",unit:"count",scope:"provider/local scan/range",measurementKind:"conversationCount",aggregation:"count observed source conversations",comparison:"same semantic source only; no cross-provider aggregation",requires:["valid source observations","explicit scope","known quantity and unit"],provenance:"source contract documented in QUOTALIS_METRIC_REGISTRY_AUDIT.md",resetBehavior:"preserve source window/period boundaries",format:"integer",visualizations:["table","stat"]},
  localRequests: {id:"localRequests",label:"Local requests",description:"source-defined request count",unit:"count",scope:"import source/range",measurementKind:"sourceRequestCount",aggregation:"source-defined request count",comparison:"same semantic source only; no cross-provider aggregation",requires:["valid source observations","explicit scope","known quantity and unit"],provenance:"source contract documented in QUOTALIS_METRIC_REGISTRY_AUDIT.md",resetBehavior:"preserve source window/period boundaries",format:"integer",visualizations:["table","stat"]},
  hourlyActivity: {id:"hourlyActivity",label:"Hourly activity",description:"count source activity by hour of week",unit:"count",scope:"provider/local scan/range",measurementKind:"activityCount",aggregation:"count source activity by hour of week",comparison:"same semantic source only; no cross-provider aggregation",requires:["valid source observations","explicit scope","known quantity and unit"],provenance:"source contract documented in QUOTALIS_METRIC_REGISTRY_AUDIT.md",resetBehavior:"preserve source window/period boundaries",format:"integer",visualizations:["table","stat"]},
  priceCoverage: {id:"priceCoverage",label:"Price coverage",description:"priced token fraction within eligible local scan; not usage",unit:"percent",scope:"provider/local scan/model catalog",measurementKind:"catalogCoverageRatio",aggregation:"priced token fraction within eligible local scan; not usage",comparison:"same semantic source only; no cross-provider aggregation",requires:["valid source observations","explicit scope","known quantity and unit"],provenance:"source contract documented in QUOTALIS_METRIC_REGISTRY_AUDIT.md",resetBehavior:"preserve source window/period boundaries",format:"percent",visualizations:["table","stat"]},
  localEstimatedSpend: {id:"localEstimatedSpend",label:"Local estimated spend",description:"eligible local pricing only; unavailable without proven billing channel",unit:"currency",scope:"provider/account/local scan/USD",measurementKind:"localEstimate",aggregation:"eligible local pricing only; unavailable without proven billing channel",comparison:"same semantic source only; no cross-provider aggregation",requires:["can_locally_estimate_cost eligible","proven billing channel","matching model price and token categories","known currency"],provenance:"source contract documented in QUOTALIS_METRIC_REGISTRY_AUDIT.md",resetBehavior:"preserve source window/period boundaries",format:"money",visualizations:["table","stat"]},
  dailyProviderCredits: {id:"dailyProviderCredits",label:"Daily provider credits",description:"provider daily credits; service sum only within same account/day",unit:"credits",scope:"provider/account/day/service",measurementKind:"providerDailyTotal",aggregation:"provider daily credits; service sum only within same account/day",comparison:"same semantic source only; no cross-provider aggregation",requires:["valid source observations","explicit scope","known quantity and unit"],provenance:"source contract documented in QUOTALIS_METRIC_REGISTRY_AUDIT.md",resetBehavior:"preserve source window/period boundaries",format:"units",visualizations:["table","stat"]},
  legacyUsageTrend: {id:"legacyUsageTrend",label:"Legacy usage trend",description:"last selected-display observation per bucket; archived, window identity unknown",unit:"percent",scope:"provider/account/legacy bucket",measurementKind:"legacyPointInTime",aggregation:"last selected-display observation per bucket; archived, window identity unknown",comparison:"unsupported: physical window identity is not established",requires:["valid source observations","explicit scope","known quantity and unit"],provenance:"source contract documented in QUOTALIS_METRIC_REGISTRY_AUDIT.md",resetBehavior:"preserve source window/period boundaries",format:"percent",visualizations:["table","stat"]},
  legacyPace: {id:"legacyPace",label:"Legacy pace",description:"elapsed-window versus quota observation; one-point linear pace, not a history forecast",unit:"state",scope:"provider/physical-window/current",measurementKind:"linearPaceState",aggregation:"elapsed-window versus quota observation; one-point linear pace, not a history forecast",comparison:"same semantic source only; no cross-provider aggregation",requires:["valid source observations","explicit scope","known quantity and unit"],provenance:"source contract documented in QUOTALIS_METRIC_REGISTRY_AUDIT.md",resetBehavior:"preserve source window/period boundaries",format:"integer",visualizations:["table","stat"]},
} as const satisfies Record<MetricId, MetricDefinition>;

export interface MetricResult {
  state: MetricAvailability;
  value: number | null;
  reason?: "identityUnknown" | "windowUnknown" | "invalidSamples" | "insufficientSamples" | "historyGap" | "resetBoundary" | "counterDecrease" | "missingData";
}
export const missingMetric = (state: MetricAvailability, reason: MetricResult["reason"]): MetricResult => ({state, value: null, reason});


const LABELS: Record<MetricId, LocaleKey> = {
  quotaStart:"V24RangeStart",
  quotaEnd:"V24RangeEnd",
  quotaChange:"V24RangeChange",
  quotaMinimum:"V24Minimum",
  quotaPeak:"V24Peak",
  highestQuota:"DashboardKpiHighestUsage",
  reportingProviders:"DashboardKpiActiveProviders",
  attentionCount:"V24Attention",
  readingAge:"V24ReadingAge",
  historyGapBuckets:"V24MissingBuckets",
  localTokens:"UsageSpendTokens",
  localConversations:"UsageSpendConversations",
  localRequests:"UsageSpendRequests",
  hourlyActivity:"UsageSpendHourlyActivity",
  priceCoverage:"UsageSpendPriceCoverage",
  localEstimatedSpend:"DashboardMetricSpend",
  dailyProviderCredits:"DashboardCredits",
  legacyUsageTrend:"DashboardMetricUsage",
  legacyPace:"DetailPaceTitle",
  quotaUsed:"V2UsedQuota", quotaRemaining:"FloatBarRemainingSuffix", quotaMean:"V2QuotaMean",
  quotaComparison:"V2PeriodDifference", quotaVelocity:"V2Velocity", reportedSpend:"DashboardMetricSpend",
  balance:"DashboardBalance", credits:"DashboardCredits", historySamples:"V2Samples", nextReset:"V2NextReset",
};
export interface RegisteredMetric extends MetricDefinition {
  source: string;
  labelKey: LocaleKey;
  descriptionKey: LocaleKey;
  temporalKind: "current" | "historical";
  crossProviderComparison: "independentQuotaState" | "sameCurrencyAndPeriod" | "sameProviderUnit" | "time" | "none";
  freshnessSemantics: "liveCadence" | "rangeCoverage";
}
export const METRIC_REGISTRY = (Object.keys(DEFINITIONS) as MetricId[]).reduce((registry,id) => {
  const definition = DEFINITIONS[id];
  const historical = ["quotaMean","quotaComparison","quotaVelocity","historySamples","reportedSpend","quotaStart","quotaEnd","quotaChange","quotaMinimum","quotaPeak","historyGapBuckets","localTokens","localConversations","localRequests","hourlyActivity","priceCoverage","localEstimatedSpend","dailyProviderCredits","legacyUsageTrend"].includes(id);
  registry[id] = {...definition, source: id.startsWith("quota") ? "quotaAnalytics.ts / physicalQuotaWindows" : id.startsWith("local") || id === "priceCoverage" || id === "hourlyActivity" ? "spend_contract.rs / cost_scanner.rs" : id === "dailyProviderCredits" ? "commands/chart.rs / cached provider dashboard" : id === "legacyPace" ? "core/usage_pace.rs" : "dashboardSelectors.ts / currentProviders.ts / dashboard_data.rs", labelKey:LABELS[id as MetricId],
    descriptionKey: id === "quotaComparison" ? "V2ComparisonCaveat" : historical ? "V2HistoryHelp" : "V2LiveQuality",
    temporalKind:historical ? "historical" : "current",
    crossProviderComparison:id === "nextReset" ? "time" : id === "reportedSpend" ? "sameCurrencyAndPeriod"
      : id === "credits" ? "sameProviderUnit" : ["quotaUsed","quotaRemaining"].includes(id) ? "independentQuotaState" : "none",
    freshnessSemantics:historical ? "rangeCoverage" : "liveCadence"};
  return registry;
}, {} as Record<MetricId, RegisteredMetric>);

/** Formatting cannot change quantity: provider credits never gain a currency suffix. */
export function formatMetric(id: MetricId, value: number | null, locale: string, currency?: string | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  const definition = METRIC_REGISTRY[id];
  if (definition.unit === "currency") {
    if (!currency || !/^[A-Z]{3}$/.test(currency)) return null;
    return new Intl.NumberFormat(locale,{style:"currency",currency,numberingSystem:"latn",maximumFractionDigits:2}).format(value);
  }
  const number = new Intl.NumberFormat(locale,{numberingSystem:"latn",maximumFractionDigits:definition.unit === "count" ? 0 : 1,
    signDisplay:definition.unit === "percentagePoints" ? "exceptZero" : "auto"}).format(value);
  return definition.unit === "percent" ? `${number}%` : number;
}

export type VisualizationTemplate="precisionTimeSeries"|"comparativeTimeSeries"|"smallMultiples"|"limitInstrument"|"resetHorizon"|"comparisonMatrix"|"coverageHeatmap"|"rankedTable"|"distribution"|"attentionRail";
export const COMPATIBLE_VISUALIZATIONS:Partial<Record<MetricId,readonly VisualizationTemplate[]>>={
 quotaUsed:["precisionTimeSeries","smallMultiples","limitInstrument","comparisonMatrix","rankedTable"],
 quotaRemaining:["limitInstrument","comparisonMatrix"],quotaComparison:["comparativeTimeSeries","comparisonMatrix"],
 historySamples:["coverageHeatmap","rankedTable"],nextReset:["resetHorizon","rankedTable"],attentionCount:["attentionRail"],
 reportedSpend:["rankedTable"],balance:["rankedTable"],credits:["rankedTable"]};
export function supportsVisualization(metric:MetricId,template:VisualizationTemplate):boolean{return COMPATIBLE_VISUALIZATIONS[metric]?.includes(template)??false;}
