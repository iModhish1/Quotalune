import {useMemo} from "react";
import {useLocale} from "../../../hooks/useLocale";
import {physicalWindowLabel,observedAccountLabel} from "../../../lib/analytics/metricLabels";
import type {DashboardAnalyticsModel} from "../../../lib/analytics/dashboardModel";
import type {SettingsSnapshot,AnalyticsPreferences,ProviderUsageSnapshot} from "../../../types/bridge";
import {createCoverageHeatmapSpec} from "../../../components/analytics/charts/chartSpec";
import {ProfessionalChart} from "../../../components/analytics/charts/ProfessionalChart";
import {useChartContext} from "../../../components/analytics/charts/useChartContext";
export default function CoverageHeatmap({model,settings,preferences,providers}:{model:DashboardAnalyticsModel;settings:SettingsSnapshot;preferences:AnalyticsPreferences;providers:ProviderUsageSnapshot[]}) {
 const {t}=useLocale(),context=useChartContext(settings,model.range,preferences);
 const spec=useMemo(()=>createCoverageHeatmapSpec(model.trends,row=>`${providers.find(p=>p.providerId===row.provider)?.displayName??row.provider} · ${physicalWindowLabel(row.windowLabel,t)} · ${observedAccountLabel(row,model.trends,t)}`,context),[model,context,providers,t]);
 return <section className="coverage-heatmap" aria-label={t("V45CoverageHeatmap")}><h3>{t("V45CoverageHeatmap")}</h3><ProfessionalChart spec={spec} unavailable={t("V2InsufficientHistory")}/><p className="chart-zoom-note">{t("V45MissingCells")}</p></section>;
}
