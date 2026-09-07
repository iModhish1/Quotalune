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
    const subscription=listen("codexbar:settings-updated",()=>void load()).catch(()=>()=>{});
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
      <label>{t("ProviderIdentityPreviewShape")}<select disabled={saving||!ready} aria-label={t("ProviderIdentityPreviewShape")} value={presentation.shape} onChange={event=>void save({...presentation,shape:event.target.value as LimitPresentation["shape"]})}><option value="ring">{t("CircularRing")}</option><option value="horizontal">{t("HorizontalBar")}</option><option value="vertical">{t("VerticalBar")}</option></select></label>
      <label>{t("IndicatorContent")}<select disabled={saving||!ready} aria-label={t("IndicatorContent")} value={presentation.content} onChange={event=>void save({...presentation,content:event.target.value as LimitPresentation["content"]})}><option value="both">{t("BarAndPercentage")}</option><option value="bar">{t("BarOnly")}</option><option value="value">{t("PercentageOnly")}</option></select></label>
      <label>{t("FillDirection")}<select disabled={saving||!ready||presentation.content==="value"} aria-label={t("FillDirection")} value={presentation.direction} onChange={event=>void save({...presentation,direction:event.target.value as LimitPresentation["direction"]})}><option value="forward">{directionLabels[0]}</option><option value="reverse">{directionLabels[1]}</option></select></label>
      <label>{t("ProviderIdentityPreviewState")}<select aria-label={t("ProviderIdentityPreviewState")} value={previewState} onChange={event=>setPreviewState(event.target.value as PreviewState)}><option value="normal">{t("ProviderIdentityStateNormal")}</option><option value="warning">{t("HighUsageAlert")}</option><option value="critical">{t("CriticalUsageAlert")}</option><option value="exhausted">{t("NotificationSoundEventExhausted")}</option></select></label>
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
