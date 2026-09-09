import {useMemo} from "react";
import {useLocale} from "../../../hooks/useLocale";
import {useResetStageOptions} from "../../../hooks/useResetStageOptions";
import {defaultResetPresentationConfig,resolveResetTimeZone} from "../../../lib/resetPresentation";
import {useDashboardStructureTheme} from "../../../surfaces/dashboard/analytics/useDashboardStructureTheme";
import {chartTheme,chartProviderColor} from "./chartTheme";
import type {AnalyticsRange} from "../../../lib/analytics/quotaAnalytics";
import type {SettingsSnapshot,AnalyticsPreferences} from "../../../types/bridge";
import type {ChartContext} from "./chartSpec";
export function useChartContext(settings:SettingsSnapshot,range:AnalyticsRange,preferences:AnalyticsPreferences):ChartContext {
 const {t,language}=useLocale(),options=useResetStageOptions(settings,"dashboard"),{theme}=useDashboardStructureTheme(settings);
 return useMemo(()=>{
  const date=new Intl.DateTimeFormat(options.locale,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",numberingSystem:"latn",timeZone:resolveResetTimeZone({...defaultResetPresentationConfig(),...options.config})});
  const number=new Intl.NumberFormat(options.locale,{maximumFractionDigits:1,numberingSystem:"latn"});
  return {range,rtl:language==="arabic",theme:chartTheme(theme,id=>chartProviderColor(theme,settings,id,document.documentElement)),date:(time:number)=>date.format(time),number:(n:number)=>number.format(n),
   labels:{current:t("V45Current"),previous:t("V45Previous"),used:t("V2UsedQuota"),samples:t("V2Samples"),missing:t("V45MissingCells"),zoom:t("V45VisualZoom"),source:t("V45SourceObservation")},style:preferences.chartStyle,lowCpu:settings.dashboardPerformancePreset==="lowCpu",highFidelity:settings.dashboardPerformancePreset==="highFidelity"};
 },[settings,range,preferences.chartStyle,theme,options,t,language]);
}
