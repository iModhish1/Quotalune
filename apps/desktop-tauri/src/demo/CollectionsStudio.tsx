import {useRef,useState} from "react";
import {SURFACE_DEMO_PROVIDERS} from "../lib/surfaceDemo";
import type {StageProvider} from "../components/orbit/stageTypes";
import type {CollectionLayoutSnapshot} from "../lib/collectionBridge";
import {QaProviderIcon,formatPercentage} from "../design-system";
import {NotchGauge} from "../surfaces/notch/NotchGauge";
import {providerAccent} from "../surfaces/notch/notchGeometry";
import {useOptionalLocale} from "../hooks/useLocale";
import {collectionLayout,DEFAULT_FIELDS,detachItem,mergeItem,moveItem,type Collection,type CollectionView,type ItemFields} from "../surfaces/collections/collectionModel";
import "./CollectionsStudio.css";

const views:CollectionView[]=["horizontal","vertical","grid"];
const unavailable=(id:string):StageProvider=>({id,name:id,iconId:id,resolvedMode:"remaining",primaryValue:null,secondaryValue:null,primaryLabel:"remaining",arcFraction:null,reset:"—",status:"offline"});
export default function CollectionsStudio({providers=SURFACE_DEMO_PROVIDERS,initialLayout,onSave}:{providers?:StageProvider[];initialLayout?:CollectionLayoutSnapshot;onSave?:(layout:CollectionLayoutSnapshot)=>Promise<CollectionLayoutSnapshot>}={}){
  const locale=useOptionalLocale();
  const initial:Collection[]=[{id:"main",items:providers.map(p=>p.id)}];
  const [groups,setGroups]=useState(initialLayout?.groups.length?initialLayout.groups:initial),[view,setView]=useState<CollectionView>(initialLayout?.view??"horizontal");
  const [fields,setFields]=useState<Record<string,ItemFields>>(initialLayout?.fields??{}),[scale,setScale]=useState(initialLayout?.scale??100);
  const [selected,setSelected]=useState(providers[0]?.id??""),[detail,setDetail]=useState<string|null>(null);
  const [pages,setPages]=useState<Record<string,number>>({}),[positions,setPositions]=useState<Record<string,{x:number;y:number}>>(Object.fromEntries((initialLayout?.groups??[]).map(g=>[g.id,{x:g.x,y:g.y}])));
  const [drag,setDrag]=useState<{item:string;x:number;y:number}|null>(null);
  const start=useRef<{item:string;x:number;y:number}|null>(null),canvas=useRef<HTMLDivElement>(null),serial=useRef(0),lastWheel=useRef(0);
  const [applied,setApplied]=useState<string|null>(null);
  const [revision,setRevision]=useState(initialLayout?.revision??0),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState<string|null>(null);
  const displayedProviders=[...providers,...groups.flatMap(g=>g.items).filter(id=>!providers.some(p=>p.id===id)).map(unavailable)];
  const config=fields[selected]??DEFAULT_FIELDS,provider=displayedProviders.find(p=>p.id===(detail??selected));
  const draft=JSON.stringify({groups,view,fields,scale,positions});
  const save=async()=>{if(!onSave){setApplied(draft);return;}setSaving(true);setSaveError(null);
    const ids=new Set(groups.flatMap(g=>g.items));
    try{const saved=await onSave({version:1,revision,view,scale,groups:groups.map((g,i)=>({...g,...(positions[g.id]??{x:20,y:24+i*150})})),fields:Object.fromEntries(Object.entries(fields).filter(([id])=>ids.has(id)))});setRevision(saved.revision);setApplied(draft);}
    catch(error){setSaveError(error instanceof Error?error.message:String(error));}finally{setSaving(false);}};
  const detach=(item:string,x=20,y?:number)=>{
    let id:string;
    do{id=`solo-${++serial.current}`;}while(groups.some(g=>g.id===id) || positions[id]);
    const next=detachItem(groups,item,id);
    if(next===groups)return;
    const nextY=y??Math.max(24,...groups.map((g,i)=>(positions[g.id]?.y??24+i*150)+collectionLayout(g.items,fields,view,scale).height+64));
    setGroups(next);setPositions(p=>({...p,[id]:{x,y:nextY}}));setPages({});};
  const gather=()=>{setGroups([{id:"main",items:[...new Set([...groups.flatMap(g=>g.items),...providers.map(p=>p.id)])]}]);setPages({});setPositions({});};
  const page=(group:Collection,step:number)=>setPages(p=>({...p,[group.id]:((p[group.id]??0)+step+Math.ceil(group.items.length/3))%Math.ceil(group.items.length/3)}));
  if(!displayedProviders.length)return <section role="status">No provider data available. Connect a provider before configuring collections.</section>;
  return <main className="collections-studio">
    {!onSave && <header><span className="collections-wordmark">Quotalis</span><h1>Collections</h1><p>Interactive design preview · synthetic data · no desktop settings changed</p></header>}
    <section className="collections-editor" aria-label="Collection editor">
      <div className="collections-views" role="group" aria-label="Collection view">{views.map(v=><button key={v} aria-pressed={view===v} onClick={()=>setView(v)}><span aria-hidden="true">{v==="grid"?"▦":v==="vertical"?"☷":"⋯"}</span>{v[0].toUpperCase()+v.slice(1)}</button>)}</div>
      <label>Size <output>{scale}%</output><input aria-label="Collection size" type="range" min="75" max="125" step="5" value={scale} onChange={e=>setScale(Number(e.target.value))}/></label>
      <label>Configure provider<select aria-label="Configure provider" value={selected} onChange={e=>setSelected(e.target.value)}>{displayedProviders.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <fieldset><legend>Visible on this provider</legend>{([['name','Provider name'],['value','Usage value'],['reset','Reset countdown']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={config[key]} onChange={e=>setFields(f=>({...f,[selected]:{...config,[key]:e.target.checked}}))}/>{label}</label>)}</fieldset>
      <div className="collections-actions"><button onClick={()=>detach(selected)}>Detach selected</button><button onClick={()=>setGroups(g=>moveItem(g,selected,-1))}>Move earlier</button><button onClick={()=>setGroups(g=>moveItem(g,selected,1))}>Move later</button><button onClick={gather}>Gather all</button></div>
      {groups.some(g=>g.items.includes(selected))&&groups.length>1&&<fieldset className="collections-targets">
        <legend>{locale?.t("CollectionsMoveTarget")??"Move selected to another collection"}</legend>
        {groups.filter(g=>!g.items.includes(selected)).map(group=>{
          const label=group.items.map(id=>displayedProviders.find(p=>p.id===id)?.name??id).join(" · ");
          return <button key={group.id} id={`collection-move-${group.id}`} title={label}
            aria-label={(locale?.t("CollectionsMoveAction")??"Move selected to {}").replace("{}",label)}
            onClick={()=>{setGroups(g=>mergeItem(g,selected,group.id));setPages({});}}>{label}</button>;
        })}
      </fieldset>}
      <p className="collections-help">{locale?.t("CollectionsArrangeHelp")??"Select a provider, detach it or move it to another collection. Gather all keeps your current order."}</p>
      <button className="collections-apply" disabled={saving} onClick={()=>{void save();}}>{saving?"Saving…":onSave?"Save collection layout":"Use in this preview"}</button><small role="status">{applied===draft?(onSave?"Layout saved — live in the Collections window":"Preview selection accepted — not saved to desktop"):applied?"Unapplied preview changes":"Draft — changes appear immediately below"}</small>{saveError&&<p role="alert">{saveError}</p>}
    </section>
    <section className="collections-preview" aria-label="Live collection preview"><h2>Live preview <small>logical px at selected scale</small></h2>
      <div ref={canvas} className="collections-canvas" onPointerMove={e=>{const s=start.current;if(!s || Math.hypot(e.clientX-s.x,e.clientY-s.y)<5)return;const r=canvas.current!.getBoundingClientRect();setDrag({item:s.item,x:e.clientX-r.left,y:e.clientY-r.top});}}
        onPointerUp={e=>{const s=start.current;start.current=null;if(!s||!drag)return;const rect=canvas.current!.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;
          const target=Array.from(canvas.current!.querySelectorAll<HTMLElement>('[data-group-id]')).find(el=>{const b=el.getBoundingClientRect();return e.clientX>=b.left&&e.clientX<=b.right&&e.clientY>=b.top&&e.clientY<=b.bottom;});
          if(target)setGroups(g=>mergeItem(g,s.item,target.dataset.groupId!));else detach(s.item,Math.max(0,Math.min(rect.width-100,x-24)),Math.max(0,Math.min(rect.height-130,y-20)));
          setDrag(null);setPages({});}}
        onPointerCancel={()=>{start.current=null;setDrag(null);}} onKeyDown={e=>{if(e.key==="Escape"){start.current=null;setDrag(null);setDetail(null);}}}>
        {groups.map((group,groupIndex)=>{const offset=((pages[group.id]??0)%Math.ceil(group.items.length/3))*3,ids=group.items.slice(offset,offset+3);
          const layout=collectionLayout(ids,fields,view,scale),pos=positions[group.id]??{x:20,y:24+groupIndex*150};
          return <div className="collections-placement" key={group.id} style={{left:pos.x,top:pos.y,maxWidth:"calc(100% - 24px)"}}>
            <output data-testid="collection-size">{Math.round(layout.width)} × {Math.round(layout.height)} px · {group.items.length} items</output>
            <div data-group-id={group.id} data-testid="collection-group" className="collections-group" data-single={group.items.length===1} style={{width:layout.width,height:layout.height}} onWheel={e=>{if(e.ctrlKey||group.items.length<=3||Math.abs(e.deltaY)<4)return;const now=performance.now();if(now-lastWheel.current<160)return;lastWheel.current=now;page(group,e.deltaY>0?1:-1);}}>
              <div className="collections-grid" style={{gridTemplateColumns:`repeat(${layout.columns},${layout.cellWidth}px)`,gridAutoRows:layout.cellHeight,padding:layout.padding,gap:layout.gap,transform:`scale(${layout.factor})`}}>
                {ids.map(id=>{const p=displayedProviders.find(p=>p.id===id)!,f=fields[id]??DEFAULT_FIELDS;return <button className="collections-item" key={id} aria-label={`${p.name} quota details`} title="Click for usage · drag to detach or regroup"
                  onPointerDown={e=>{if(e.button!==0)return;start.current={item:id,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture?.(e.pointerId);}}
                  onClick={()=>{if(drag)return;setSelected(id);setDetail(id);}}
                  onMouseEnter={()=>{if(!start.current)setDetail(id);}}>
                  <span className="collections-dot"><NotchGauge fraction={p.arcFraction} size={36} color={providerAccent(id)} label={`${p.name} quota`}/><QaProviderIcon providerId={p.iconId} size={18}/></span>
                  {f.name&&<span title={p.name}>{p.name}</span>}{f.value&&<span>{formatPercentage(p.primaryValue)}</span>}{f.reset&&<span className="collections-reset" title={`Resets in ${p.reset}`}>{p.reset}</span>}
                </button>;})}
              </div>
            </div>
            {group.items.length>3&&<div className="collections-pagination"><button aria-label="Previous providers" onClick={()=>page(group,-1)}>‹</button><span>{offset+1}–{Math.min(offset+3,group.items.length)} / {group.items.length}</span><button aria-label="Next providers" onClick={()=>page(group,1)}>›</button></div>}
          </div>;
        })}
        {drag&&<div className="collections-drag" style={{left:drag.x-20,top:drag.y-20}}><QaProviderIcon providerId={drag.item} size={20}/></div>}
      </div>
    </section>
    {detail&&provider&&<section className="collections-details" role="region" aria-label={`${provider.name} usage details`}><header><QaProviderIcon providerId={provider.iconId} size={22}/><h2>{provider.name}</h2><button aria-label="Close details" onClick={()=>setDetail(null)}>×</button></header><strong>{formatPercentage(provider.primaryValue)} {provider.primaryLabel}</strong><p>Resets in {provider.reset}</p><small>{onSave?"Selected quota from provider snapshot. Additional windows are not yet exposed here.":"Selected quota · synthetic preview. Additional quota windows require live provider data."}</small></section>}
  </main>;
}
