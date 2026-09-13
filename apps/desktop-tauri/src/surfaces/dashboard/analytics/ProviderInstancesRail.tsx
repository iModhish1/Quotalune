import {useProviderInstances} from "../../../hooks/useProviderInstances";
import {useCallback,useRef,useState} from "react";
import {LatestWriteQueue} from "../../../lib/latestWriteQueue";
import {useSettings} from "../../../hooks/useSettings";
import {useLocale} from "../../../hooks/useLocale";
import {composeProviderInstances, DEFAULT_INSTANCE_PRESENTATION} from "../../../lib/providerInstances";
import type {ProviderUsageSnapshot, SettingsSnapshot,ProviderInstancePresentation} from "../../../types/bridge";
import ProviderRail from "./ProviderRail";

const DEMO_RAIL_KEY='quotalis.demo.providerRail.v1';
function loadDemoRail():ProviderInstancePresentation {
  try {
    const value=JSON.parse(localStorage.getItem(DEMO_RAIL_KEY)??'null');
    if(value&&Array.isArray(value.order)&&value.order.every((id:unknown)=>typeof id==='string'))
      return {...DEFAULT_INSTANCE_PRESENTATION,...value,visibleCount:value.visibleCount===3?3:4};
  } catch {/* A missing/corrupt Demo preference does not affect real settings. */}
  return DEFAULT_INSTANCE_PRESENTATION;
}

export default function ProviderInstancesRail(props: {
  providers: ProviderUsageSnapshot[]; settings: SettingsSnapshot; isDemo: boolean;
  onOpenProviders: (id?: string) => void; onAnalytics: (id?: string) => void;
}) {
  const {t} = useLocale();
  const {settings, update, saving, error} = useSettings(props.settings);
  const accounts = useProviderInstances(!props.isDemo);
  const saved = settings.providerInstancePresentation ?? DEFAULT_INSTANCE_PRESENTATION;
  const [optimistic,setOptimistic]=useState<ProviderInstancePresentation|null>(null);
  const updateRef=useRef(update);updateRef.current=update;
  const queue=useRef<LatestWriteQueue<ProviderInstancePresentation>>();
  queue.current??=new LatestWriteQueue(saved,value=>updateRef.current({providerInstancePresentation:value}));
  queue.current.synchronize(saved);
  const save=useCallback(async(patch:Partial<ProviderInstancePresentation>)=>{
    setOptimistic(current=>({...saved,...current,...patch}));
    await queue.current!.push(patch);
    setOptimistic(null);
  },[saved]);
  const [demo,setDemo]=useState(loadDemoRail),[demoError,setDemoError]=useState(false);
  const demoRef=useRef(demo);demoRef.current=demo;
  const saveDemo=useCallback(async(patch:Partial<ProviderInstancePresentation>)=>{
    const next={...demoRef.current,...patch};demoRef.current=next;setDemo(next);
    try{localStorage.setItem(DEMO_RAIL_KEY,JSON.stringify(next));setDemoError(false);}catch{setDemoError(true);}
  },[]);
  const presentation = props.isDemo ? demo : optimistic ?? saved;
  const instances = composeProviderInstances(props.providers, props.isDemo?[]:accounts.instances, settings.enabledProviders, presentation);
  return <>
    {accounts.error && <p role="status">{t("InstanceLoadUnavailable")}</p>}
    {(error||demoError) && <p role="alert">{t("InstanceSaveFailed")}</p>}
    <ProviderRail key={props.isDemo?'demo':'real'} {...props} settings={settings} instances={instances} presentation={presentation}
      savingPresentation={!props.isDemo&&saving} onPresentationChange={props.isDemo ? saveDemo : save}/>
  </>;
}
