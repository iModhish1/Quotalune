import {useEffect,useMemo,useState} from "react";
import {listen} from "@tauri-apps/api/event";
import UsageWindowList from "../../../components/orbit/UsageWindowList";
import type {StageUsageWindow} from "../../../components/orbit/stageTypes";
import {DEFAULT_LIMIT_PRESENTATION,PROVIDER_PRESENTATION_IDENTITIES,type LimitPresentation,type ProviderPresentationIdentity} from "../../../design-system/limitPresentation";
import {getSettingsSnapshot,setGlobalLimitPresentation} from "../../../lib/tauri";
import {providerMeterFillColor} from "../../../design-system/meterFill";
import {useLocale} from "../../../hooks/useLocale";
import {resolveCatalogTheme} from "../../../design-system/themeResolution";
import {catalogBySlug} from "../../../design-system/themeCatalog";
import {resolveVisualComposition} from "../../../design-system/visualComposition";
import {Select} from "../../../components/FormControls";
import "./ProviderIdentityGallery.css";

const NAMES:Record<ProviderPresentationIdentity,string>={
  adaptive:"Adaptive",precision:"Precision",glass:"Glass",pearl:"Pearl",prism:"Aurora Prism",mono:"Stealth Mono",signal:"Signal",luxe:"Luxe",
  frost:"Arctic Frost",ember:"Solar Ember",jade:"Jade Pavilion",rose:"Rose Signal",cobalt:"Cobalt",bronze:"Bronze Alloy",paper:"Ivory Paper",ultraviolet:"Ultraviolet",
  midnight:"Midnight Glass",aerogel:"Mint Aerogel",porcelain:"Cobalt Porcelain",champagne:"Champagne Glass",terracotta:"Terracotta Halo",cyberlime:"Cyber Lime",graphite:"Graphite Studio",royal:"Royal Amethyst",
};
const LIGHT=new Set<ProviderPresentationIdentity>(["pearl","frost","paper","aerogel","porcelain","champagne"]);
const WINDOWS:StageUsageWindow[]=[
  {id:"five-hour",label:"5-hour",primaryValue:73,primaryLabel:"remaining",arcFraction:.73,reset:"3h 42m",resetsAt:null},
  {id:"weekly",label:"Weekly",primaryValue:41,primaryLabel:"remaining",arcFraction:.41,reset:"4d 9h",resetsAt:null},
];
type PreviewState="normal"|"warning"|"critical"|"exhausted";
const PREVIEW_REMAINING:Record<PreviewState,number>={normal:73,warning:20,critical:10,exhausted:0};

export default function ProviderIdentityGallery(){
  const {t}=useLocale();
  const [presentation,setPresentation]=useState<LimitPresentation>(DEFAULT_LIMIT_PRESENTATION);
  const [query,setQuery]=useState("");
  const [previewState,setPreviewState]=useState<PreviewState>("normal");
  const [saving,setSaving]=useState(false);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState<string>();
  // The active Structure Theme's display name — used only for the
  // provenance line ("Following <name>"); does not otherwise affect
  // resolution (Wave 6 Phase 4: resolveVisualComposition treats
  // structureThemeId as opaque, since no per-theme recommended-identity
  // mapping currently exists — see docs/validation/VISUAL_THEME_OWNERSHIP.md).
  const [structureThemeName,setStructureThemeName]=useState<string>("");
  useEffect(()=>{
    let alive=true;
    const load=()=>getSettingsSnapshot().then(snapshot=>{
      if(!alive)return;
      setPresentation(snapshot.globalLimitPresentation??DEFAULT_LIMIT_PRESENTATION);
      setReady(true);
      const {slug}=resolveCatalogTheme(snapshot,"dashboard");
      setStructureThemeName(catalogBySlug(slug)?.name??slug);
    }).catch(cause=>{if(alive)setError(String(cause));});
    void load();
    const subscription=listen("quotalis:settings-updated",()=>void load()).catch(()=>()=>{});
    return()=>{alive=false;void subscription.then(stop=>stop());};
  },[]);
  const composition=useMemo(()=>resolveVisualComposition({
    structureThemeId:structureThemeName,
    identity:presentation.identity,
  }),[structureThemeName,presentation.identity]);
  const identities=useMemo(()=>PROVIDER_PRESENTATION_IDENTITIES.filter(identity=>`${identity} ${NAMES[identity]} ${identity==="adaptive"?t("ProviderPresentationFollowStructureName"):""}`.toLowerCase().includes(query.trim().toLowerCase())),[query,t]);
  const previewWindows=useMemo(()=>WINDOWS.map((window,index)=>index===0?{...window,primaryValue:PREVIEW_REMAINING[previewState],arcFraction:PREVIEW_REMAINING[previewState]/100}:window),[previewState]);
  async function save(next:LimitPresentation){
    const previous=presentation;
    setPresentation(next);setSaving(true);setError(undefined);
    try{await setGlobalLimitPresentation(next);}catch(cause){setPresentation(previous);setError(cause instanceof Error?cause.message:String(cause));}finally{setSaving(false);}
  }
  const directionLabels=presentation.shape==="ring"?[t("Clockwise"),t("Counterclockwise")]:presentation.shape==="vertical"?[t("BottomToTop"),t("TopToBottom")]:[t("LeftToRight"),t("RightToLeft")];
  // Wave 6 Phase 4: "adaptive" displays as "Follow Structure" everywhere
  // in this gallery — the stored identity value is unchanged, only the
  // label a user sees.
  const displayName=(identity:ProviderPresentationIdentity)=>identity==="adaptive"?t("ProviderPresentationFollowStructureName"):NAMES[identity];
  const provenanceText=composition.presentationSource==="followStructure"
    ?`${t("ProviderPresentationFollowingPrefix")} ${structureThemeName||"…"}`
    :`${t("ProviderPresentationIndependentLabel")} — ${displayName(composition.resolvedProviderPresentationIdentity)}`;
  return <section className="settings-section provider-identity-gallery" aria-label={t("ProviderIdentityGalleryTitle")}>
    <div className="provider-identity-gallery__heading"><div><span>{t("ProviderIdentityGalleryEyebrow")}</span><h3 className="settings-section__title">{t("ProviderIdentityGalleryTitle")}</h3><p className="settings-section__description">{t("ProviderIdentityGalleryHelper")}</p></div><output>{PROVIDER_PRESENTATION_IDENTITIES.length} {t("ProviderIdentityCountLabel")}</output></div>
    <p className="provider-identity-gallery__provenance"><strong>{t("ProviderPresentationSourceLabel")}:</strong> {provenanceText}</p>
    <div className="provider-identity-gallery__controls">
      <label>{t("ProviderIdentityPreviewShape")}<Select disabled={saving||!ready} ariaLabel={t("ProviderIdentityPreviewShape")} value={presentation.shape} onChange={value=>void save({...presentation,shape:value as LimitPresentation["shape"]})} options={[
        {value:"ring",label:t("CircularRing")},{value:"horizontal",label:t("HorizontalBar")},{value:"vertical",label:t("VerticalBar")},
      ]}/></label>
      <label>{t("IndicatorContent")}<Select disabled={saving||!ready} ariaLabel={t("IndicatorContent")} value={presentation.content} onChange={value=>void save({...presentation,content:value as LimitPresentation["content"]})} options={[
        {value:"both",label:t("BarAndPercentage")},{value:"bar",label:t("BarOnly")},{value:"value",label:t("PercentageOnly")},
      ]}/></label>
      <label>{t("FillDirection")}<Select disabled={saving||!ready||presentation.content==="value"} ariaLabel={t("FillDirection")} value={presentation.direction} onChange={value=>void save({...presentation,direction:value as LimitPresentation["direction"]})} options={[
        {value:"forward",label:directionLabels[0]},{value:"reverse",label:directionLabels[1]},
      ]}/></label>
      <label>{t("ProviderIdentityPreviewState")}<Select ariaLabel={t("ProviderIdentityPreviewState")} value={previewState} onChange={value=>setPreviewState(value as PreviewState)} options={[
        {value:"normal",label:t("ProviderIdentityStateNormal")},{value:"warning",label:t("HighUsageAlert")},{value:"critical",label:t("CriticalUsageAlert")},{value:"exhausted",label:t("NotificationSoundEventExhausted")},
      ]}/></label>
      <label>{t("ProviderIdentitySearch")}<input aria-label={t("ProviderIdentitySearch")} value={query} onChange={event=>setQuery(event.target.value)} placeholder={t("ProviderIdentitySearchPlaceholder")}/></label>
    </div>
    {error&&<p className="provider-identity-gallery__error" role="alert">{error}</p>}
    <div className="provider-identity-gallery__grid">
      {identities.map(identity=><article key={identity} data-selected={(presentation.identity??"adaptive")===identity} data-follow-structure={identity==="adaptive"}>
        <div className="provider-identity-gallery__preview" style={{"--provider-color":providerMeterFillColor("#10a37f",identity)} as React.CSSProperties}><UsageWindowList providerId="codex" windows={previewWindows} presentation={{...presentation,identity}}/></div>
        <div className="provider-identity-gallery__meta"><span><strong>{displayName(identity)}</strong>{identity==="adaptive"&&<em className="provider-identity-gallery__recommended">{t("ProviderPresentationRecommendedBadge")}</em>}<small>{identity==="adaptive"?t("ProviderIdentityAdaptiveHelper"):LIGHT.has(identity)?t("ProviderIdentityLightHelper"):t("ProviderIdentityDarkHelper")}</small></span><i aria-hidden="true" data-tone={LIGHT.has(identity)?"light":"dark"}/></div>
        <button type="button" aria-label={`${t("ApplyProviderIdentity")} ${displayName(identity)}`} aria-pressed={(presentation.identity??"adaptive")===identity} disabled={saving||!ready} onClick={()=>void save({...presentation,identity})}>{(presentation.identity??"adaptive")===identity?t("SelectedProviderIdentity"):t("ApplyProviderIdentity")}</button>
      </article>)}
    </div>
  </section>;
}
