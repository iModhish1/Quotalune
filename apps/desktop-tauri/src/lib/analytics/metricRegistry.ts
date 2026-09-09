/** Analytics contracts, independent of React, theme, chart style and provider branding. */
export type MetricAvailability = "available" | "partial" | "insufficientHistory" | "unsupported" | "stale" | "unavailable" | "error";
export type MetricUnit = "percent" | "percentagePoints" | "percentagePointsPerHour" | "currency" | "credits" | "count" | "timestamp";
export type MetricId = "quotaUsed" | "quotaRemaining" | "quotaMean" | "quotaComparison" | "quotaVelocity" | "reportedSpend" | "balance" | "credits" | "historySamples" | "nextReset";
export interface MetricDefinition {
  id: MetricId; label: string; description: string; unit: MetricUnit;
  scope: string; measurementKind: string; aggregation: string; comparison: string;
  requires: readonly string[]; provenance: string; resetBehavior: string;
  format: "percent" | "signedPoints" | "rate" | "money" | "units" | "integer" | "reset";
  visualizations: readonly string[];
}
const quota = {scope: "provider/observed-account/physical-window", measurementKind: "pointInTime", provenance: "provider observation", resetBehavior: "cycle endpoint is identity for rate calculations"};
export const METRIC_REGISTRY = {
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
} as const satisfies Record<MetricId, MetricDefinition>;

export interface MetricResult {
  state: MetricAvailability;
  value: number | null;
  reason?: "identityUnknown" | "windowUnknown" | "invalidSamples" | "insufficientSamples" | "historyGap" | "resetBoundary" | "counterDecrease" | "missingData";
}
export const missingMetric = (state: MetricAvailability, reason: MetricResult["reason"]): MetricResult => ({state, value: null, reason});
