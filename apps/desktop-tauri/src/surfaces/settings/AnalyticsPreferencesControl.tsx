import type {AnalyticsPreferences, SettingsSnapshot, SettingsUpdate} from "../../types/bridge";
import type {LocaleKey} from "../../i18n/keys";
import {useLocale} from "../../hooks/useLocale";
import {analyticsPreferences, DEFAULT_ANALYTICS_PREFERENCES} from "../../lib/analytics/preferences";
import {SettingsPreview, SettingsResetAction, SettingsRow, SettingsSection, SettingsSelect, SettingsToggle} from "./SettingsControls";
export const SECTION_LABELS: Record<string, LocaleKey> = {limits: "DashboardLimitsNow", attention: "V2Attention", overview: "V24Trends", resets: "V2ResetHorizon", comparison: "V2ProviderComparison", history: "V2DetailedHistory", quality: "V2DataQuality"};
const ranges = {today: "DashboardRangeToday", last7Days: "DashboardRangeLast7Days", last30Days: "DashboardRangeLast30Days", thisMonth: "DashboardRangeThisMonth", last3Months: "DashboardRangeLast3Months", thisYear: "DashboardRangeThisYear"} as const;
export default function AnalyticsPreferencesControl({settings, update, disabled}: {settings: SettingsSnapshot; update: (patch: SettingsUpdate) => Promise<unknown>; disabled: boolean}) {
  const {t} = useLocale();
  const prefs = analyticsPreferences(settings.analyticsPreferences);
  const set = (patch: Partial<AnalyticsPreferences>) => update({analyticsPreferences: {...prefs, ...patch}});
  return <>
    <SettingsSection title={t("V2AnalyticsPresentation")} description={t("V2PresentationHelp")}>
      <SettingsRow label={t("V2DefaultRange")}><SettingsSelect ariaLabel={t("V2DefaultRange")} disabled={disabled} value={prefs.defaultRange} options={Object.entries(ranges).map(([value, key]) => ({value, label: t(key)}))} onChange={value => {void set({defaultRange: value as AnalyticsPreferences["defaultRange"]});}} /></SettingsRow>
      <SettingsRow label={t("V2FilterScope")}><SettingsSelect ariaLabel={t("V2FilterScope")} disabled={disabled} value={prefs.providerFilterScope} options={[{value: "history", label: t("V2HistoryOnly")}, {value: "all", label: t("V2AllSections")}]} onChange={value => {void set({providerFilterScope: value as AnalyticsPreferences["providerFilterScope"]});}} /></SettingsRow>
      <SettingsRow label={t("V2ChartStyle")}><SettingsSelect ariaLabel={t("V2ChartStyle")} disabled={disabled} value={prefs.chartStyle} options={[{value: "precision", label: t("V2Precision")}, {value: "minimal", label: t("V2Minimal")}, {value: "detailed", label: t("V2Detailed")}]} onChange={value => {void set({chartStyle: value as AnalyticsPreferences["chartStyle"]});}} /></SettingsRow>
      <SettingsRow label={t("V2QuotaTemplate")}><SettingsSelect ariaLabel={t("V2QuotaTemplate")} disabled={disabled} value={prefs.quotaTemplate} options={[{value: "precision", label: t("V2Precision")}, {value: "compact", label: t("WorkspaceCompact")}, {value: "dual", label: t("V2Dual")}, {value: "rail", label: t("V2Rail")}]} onChange={value => {void set({quotaTemplate: value as AnalyticsPreferences["quotaTemplate"]});}} /></SettingsRow>
      <SettingsPreview label={t("V2IllustrativePreview")}><svg viewBox="0 0 240 44" width="240" height="44" aria-hidden="true" style={{maxWidth: "100%"}}>
        {prefs.chartStyle !== "minimal" && [10, 22, 34].map(y => <path key={y} d={`M0 ${y}H240`} stroke="currentColor" opacity=".12"/>)}
        <path d="M2 35L60 28L120 31L180 16L238 8" fill="none" stroke="var(--qa-accent,currentColor)" strokeWidth="2"/>
        {prefs.chartStyle === "detailed" && [[2,35],[60,28],[120,31],[180,16],[238,8]].map(([cx,cy]) => <circle key={cx} cx={cx} cy={cy} r="3" fill="currentColor" />)}
      </svg></SettingsPreview>
    </SettingsSection>
    <SettingsSection title={t("V2DashboardSections")} description={t("V2DashboardSectionsHelp")}>
      <ol className="analytics-layout-editor">{prefs.sectionOrder.map((id, index) => <li key={id} draggable={!disabled} onDragStart={event=>event.dataTransfer.setData("text/plain",id)} onDragOver={event=>{if(!disabled)event.preventDefault();}} onDrop={event=>{event.preventDefault();if(disabled)return;const source=event.dataTransfer.getData("text/plain");if(source===id || !prefs.sectionOrder.includes(source as typeof id))return;const order=prefs.sectionOrder.filter(value=>value!==source);order.splice(order.indexOf(id),0,source as typeof id);void set({sectionOrder:order});}}>
        <SettingsToggle label={t(SECTION_LABELS[id])} disabled={disabled} checked={!prefs.hiddenSections.includes(id)} onChange={visible => {void set({hiddenSections: visible ? prefs.hiddenSections.filter(value => value !== id) : [...prefs.hiddenSections, id]});}} />
        <span>{[-1,1].map(direction => <button type="button" key={direction} disabled={disabled || index + direction < 0 || index + direction >= prefs.sectionOrder.length} aria-label={`${t(direction < 0 ? "ProviderSidebarMoveUp" : "ProviderSidebarMoveDown")} ${t(SECTION_LABELS[id])}`} onClick={() => {const order = [...prefs.sectionOrder]; [order[index], order[index + direction]] = [order[index + direction], order[index]]; void set({sectionOrder: order});}}>{direction < 0 ? "↑" : "↓"}</button>)}</span>
      </li>)}</ol>
      <SettingsResetAction label={t("V24ResetLayout")} onReset={() => set({sectionOrder:[...DEFAULT_ANALYTICS_PREFERENCES.sectionOrder],hiddenSections:[...DEFAULT_ANALYTICS_PREFERENCES.hiddenSections]})}/>
    </SettingsSection>
  </>;
}
