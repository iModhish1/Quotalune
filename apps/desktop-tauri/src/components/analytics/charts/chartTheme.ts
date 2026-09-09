import {providerColor, type CatalogTheme} from "../../../design-system/themeCatalog";
import {resolveVisualComposition} from "../../../design-system/visualComposition";
import {providerCreditsColor} from "../../charts/chartPalette";
import {accessibleMeterFill} from "../../../design-system/meterFill";
import type {SettingsSnapshot} from "../../../types/bridge";
export interface QuotalisChartTheme {background:string; text:string; muted:string; grid:string; accent:string; edge:string; font:string; series:(id:string)=>string;}
export function chartTheme(theme:CatalogTheme, seriesColor:(id:string)=>string):QuotalisChartTheme {
  return {background:theme.core,text:theme.material?.text ?? "#e8edf2",muted:theme.material?.muted ?? "#aeb9c5",grid:theme.hairline,accent:theme.accent,edge:theme.coreEdge,font:"Segoe UI, system-ui, sans-serif",series:theme.material?.light ? id=>accessibleMeterFill(seriesColor(id),theme.core) : seriesColor};
}
export function chartProviderColor(theme:CatalogTheme,settings:SettingsSnapshot,id:string,root:HTMLElement):string {
  const composition=resolveVisualComposition({structureThemeId:theme.slug,identity:settings.globalLimitPresentation?.identity,providerOverrideIdentity:settings.providerLimitPresentation?.[id]?.identity,providerId:id});
  if(composition.presentationSource === "followStructure") return providerColor(theme,id);
  const token=providerCreditsColor(id).match(/var\((--[\w-]+)/)?.[1];
  return token ? getComputedStyle(root).getPropertyValue(token).trim() || theme.accent : theme.accent;
}
