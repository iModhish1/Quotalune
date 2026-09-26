import type { LocaleKey } from "../../i18n/keys";
import type { AnalyticsSourceDescriptor, AnalyticsSourceId } from "../../types/bridge";

/** Presentation labels for the five backend-authoritative source IDs. */
const SOURCE_LABEL_KEY: Record<AnalyticsSourceId, LocaleKey> = {
  providerCurrentState: "AnalyticsSourceProviderCurrentState",
  providerHistory: "AnalyticsSourceProviderHistory",
  providerReportedMonetary: "AnalyticsSourceProviderReportedMonetary",
  codexLocalActivity: "AnalyticsSourceCodexLocalActivity",
  claudeLocalActivity: "AnalyticsSourceClaudeLocalActivity",
};

export function analyticsSourceLabel(
  source: AnalyticsSourceDescriptor,
  t: (key: LocaleKey) => string,
): string {
  const key = SOURCE_LABEL_KEY[source.id];
  return key ? t(key) : source.label;
}
