import type {AnalyticsPreferences} from "../../types/bridge";
export const ANALYTICS_SECTIONS = ["limits", "attention", "overview", "resets", "quality", "comparison", "history"] as const;
export type AnalyticsSection = typeof ANALYTICS_SECTIONS[number];
export const DEFAULT_ANALYTICS_PREFERENCES: AnalyticsPreferences = {
  sectionOrder: [...ANALYTICS_SECTIONS], hiddenSections: [], chartStyle: "precision", quotaTemplate: "precision", defaultRange: "last7Days", providerFilterScope: "history",
};
/** Same normalization as Rust. No metric values are inputs to these preferences. */
export function analyticsPreferences(value?: Partial<AnalyticsPreferences> | null): AnalyticsPreferences {
  const validIds = (items?: string[]) => [...new Set((items ?? []).filter(id => (ANALYTICS_SECTIONS as readonly string[]).includes(id)))];
  const order = validIds(value?.sectionOrder);
  const defaults = DEFAULT_ANALYTICS_PREFERENCES;
  return {
    sectionOrder: [...order, ...ANALYTICS_SECTIONS.filter(id => !order.includes(id))], hiddenSections: validIds(value?.hiddenSections),
    chartStyle: ["precision", "minimal", "detailed"].includes(value?.chartStyle ?? "") ? value!.chartStyle! : defaults.chartStyle,
    quotaTemplate: ["precision", "compact", "dual", "rail"].includes(value?.quotaTemplate ?? "") ? value!.quotaTemplate! : defaults.quotaTemplate,
    defaultRange: ["today", "last7Days", "last30Days", "thisMonth", "last3Months", "thisYear"].includes(value?.defaultRange ?? "") ? value!.defaultRange! : defaults.defaultRange,
    providerFilterScope: value?.providerFilterScope === "all" ? "all" : "history",
  };
}
