import {useEffect,useState} from "react";
import {listen} from "@tauri-apps/api/event";
import {useStageRuntime} from "../../hooks/useStageRuntime";
import {getCollectionLayout,type CollectionLayoutSnapshot} from "../../lib/collectionBridge";
import type {StageProvider} from "../../components/orbit/stageTypes";
import {QaProviderIcon,formatPercentage} from "../../design-system";
import {NotchGauge} from "../notch/NotchGauge";
import {providerAccent} from "../notch/notchGeometry";
import {DEFAULT_FIELDS,collectionLayout} from "./collectionModel";
import {useOptionalLocale} from "../../hooks/useLocale";
import type {LocaleKey} from "../../i18n/keys";
import "../../demo/CollectionsStudio.css";

const unavailable=(id:string):StageProvider=>({id,name:id,iconId:id,resolvedMode:"remaining",primaryValue:null,secondaryValue:null,primaryLabel:"remaining",arcFraction:null,reset:"—",status:"offline"});

/** The native, always-live rendering of the `collection_layout` a user saves
 * in Settings → Collections — the detached "Collections" window's content.
 * Read-only by design: editing stays in Settings (`CollectionsStudio`), this
 * view only displays the saved result and refreshes when it changes. */
export default function CollectionsNativeView(){
  const locale=useOptionalLocale();
  const t=(key:LocaleKey,fallback:string)=>locale?.t(key)??fallback;
  const runtime=useStageRuntime({surface:"top"});
  const [layout,setLayout]=useState<CollectionLayoutSnapshot|null>(null);
  const [error,setError]=useState(false);
  const [detail,setDetail]=useState<string|null>(null);

  useEffect(()=>{
    let active=true;
    const load=()=>void getCollectionLayout().then(value=>{if(active){setLayout(value);setError(false);}}).catch(()=>{if(active)setError(true);});
    load();
    const unlisten=listen("quotaarc:collections-changed",load);
    return ()=>{active=false;void unlisten.then(f=>f());};
  },[]);

  if(error)return <p role="alert">{t("CollectionsNativeLoadError","Could not load collection layout.")}</p>;
  if(runtime.settingsError)return <p role="alert">{t("CollectionsNativeSettingsError","Collection settings are unavailable.")}</p>;
  if(!layout)return <p role="status">{t("CollectionsNativeLoading","Loading collections…")}</p>;

  const providers:StageProvider[]=[...runtime.providers];
  for(const id of layout.groups.flatMap(g=>g.items))if(!providers.some(p=>p.id===id))providers.push(unavailable(id));

  if(!layout.groups.length){
    return <main className="collections-studio"><header><span className="collections-wordmark">Quotalune</span><h1>{t("TabCollections","Collections")}</h1><p>{t("CollectionsNativeEmpty","No collections saved yet. Open Settings → Collections to group providers, choose a layout and save it here.")}</p></header></main>;
  }

  const provider=providers.find(p=>p.id===detail);
  // Positions are saved relative to the Settings editor's own canvas, which
  // has no fixed size in this window — grow the canvas to fit every group's
  // saved position instead of clipping or leaving unexplained blank space.
  const contentHeight=Math.max(0,...layout.groups.map(group=>group.y+collectionLayout(group.items,layout.fields,layout.view,layout.scale).height))+24;
  return <main className="collections-studio">
    <header><span className="collections-wordmark">Quotalune</span><h1>{t("TabCollections","Collections")}</h1><p>{t("CollectionsNativeLive","Live · click a provider for details")}</p></header>
    <section className="collections-preview" aria-label={t("TabCollections","Collections")}>
      <div className="collections-canvas" data-native="true" style={{minHeight:contentHeight}}>
        {layout.groups.map(group=>{
          const dims=collectionLayout(group.items,layout.fields,layout.view,layout.scale);
          const pos={x:group.x,y:group.y};
          return <div className="collections-placement" key={group.id} style={{left:pos.x,top:pos.y,maxWidth:"calc(100% - 24px)"}}>
            <div data-testid="collection-group" className="collections-group" data-single={group.items.length===1} style={{width:dims.width,height:dims.height}}>
              <div className="collections-grid" style={{gridTemplateColumns:`repeat(${dims.columns},${dims.cellWidth}px)`,gridAutoRows:dims.cellHeight,padding:dims.padding,gap:dims.gap,transform:`scale(${dims.factor})`}}>
                {group.items.map(id=>{
                  const p=providers.find(x=>x.id===id)!,f=layout.fields[id]??DEFAULT_FIELDS;
                  return <button className="collections-item" key={id} aria-label={t("CollectionsStudioQuotaDetails","{} quota details").replace("{}",p.name)} onClick={()=>setDetail(id)}>
                    <span className="collections-dot"><NotchGauge fraction={p.arcFraction} size={36} color={providerAccent(id)} label={t("CollectionsStudioQuota","{} quota").replace("{}",p.name)}/><QaProviderIcon providerId={p.iconId} size={18}/></span>
                    {f.name&&<span title={p.name}>{p.name}</span>}{f.value&&<span>{formatPercentage(p.primaryValue)}</span>}{f.reset&&<span className="collections-reset" title={t("CollectionsStudioResetsIn","Resets in {}").replace("{}",p.reset)}>{p.reset}</span>}
                  </button>;
                })}
              </div>
            </div>
          </div>;
        })}
      </div>
    </section>
    {detail&&provider&&<section className="collections-details" role="region" aria-label={t("CollectionsStudioUsageDetails","{} usage details").replace("{}",provider.name)}><header><QaProviderIcon providerId={provider.iconId} size={22}/><h2>{provider.name}</h2><button aria-label={t("CollectionsStudioClose","Close details")} onClick={()=>setDetail(null)}>×</button></header><strong>{formatPercentage(provider.primaryValue)} {t(provider.primaryLabel==="used"?"PanelUsedSuffix":"FloatBarRemainingSuffix",provider.primaryLabel)}</strong><p>{t("CollectionsStudioResetsIn","Resets in {}").replace("{}",provider.reset)}</p></section>}
  </main>;
}
