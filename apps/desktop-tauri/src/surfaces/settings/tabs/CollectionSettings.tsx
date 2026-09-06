import {useEffect,useState} from "react";
import CollectionsStudio from "../../../demo/CollectionsStudio";
import {useStageRuntime} from "../../../hooks/useStageRuntime";
import {getCollectionLayout,setCollectionLayout,type CollectionLayoutSnapshot} from "../../../lib/collectionBridge";
import type {StageProvider} from "../../../components/orbit/stageTypes";

/** Mount only on explicit editor open; never seed fixtures into real settings. */
export default function CollectionSettings(){
  const runtime=useStageRuntime({surface:"top"});
  const [layout,setLayout]=useState<CollectionLayoutSnapshot|null>(null),[error,setError]=useState<string|null>(null);
  useEffect(()=>{let active=true;void getCollectionLayout().then(value=>{if(active)setLayout(value);}).catch(e=>{if(active)setError(String(e));});return()=>{active=false;};},[]);
  if(error)return <p role="alert">Could not load collection settings: {error}</p>;
  if(runtime.settingsError)return <p role="alert">{runtime.settingsError}</p>;
  if(!layout)return <p role="status">Loading collection layout…</p>;
  // Missing/offline identities must retain their saved placement, not vanish.
  const providers:StageProvider[]=[...runtime.providers];
  for(const id of layout.groups.flatMap(g=>g.items))if(!providers.some(p=>p.id===id))providers.push({id,name:id,iconId:id,resolvedMode:"remaining",primaryValue:null,secondaryValue:null,primaryLabel:"remaining",arcFraction:null,reset:"—",status:"offline"});
  if(!providers.length)return <p role="status">No provider snapshots available yet. Connect or refresh a provider to begin.</p>;
  return <CollectionsStudio providers={providers} initialLayout={layout} onSave={setCollectionLayout}/>;
}
