import { useId, useState, type ReactNode } from "react";
import { useLocale } from "../../../hooks/useLocale";

/** One composition for every provider; capabilities decide the contents of each slot. */
export function ProviderDetailWorkspace({overview, connections, presentation}: {overview: ReactNode; connections: ReactNode; presentation: ReactNode}) {
  const {t}=useLocale();
  const id=useId();
  const [selected,setSelected]=useState(0);
  const tabs=[{label:"ProviderWorkspaceOverview",content:overview},{label:"ProviderWorkspaceConnections",content:connections},{label:"ProviderWorkspacePresentation",content:presentation}] as const;
  return <div className="provider-detail-composition">
    <div className="provider-detail-composition__tabs" role="tablist" aria-label={t("TabProviders")}>
      {tabs.map((tab,index)=><button type="button" role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={selected===index} tabIndex={selected===index?0:-1} key={tab.label}
        onClick={()=>setSelected(index)} onKeyDown={event=>{
          const rtl=document.documentElement.dir==="rtl";
          const forward=rtl?"ArrowLeft":"ArrowRight",backward=rtl?"ArrowRight":"ArrowLeft";
          const target=event.key==="Home"?0:event.key==="End"?2:event.key===forward?(index+1)%3:event.key===backward?(index+2)%3:-1;
          if(target>=0){event.preventDefault();setSelected(target);document.getElementById(`${id}-tab-${target}`)?.focus();}
        }}>{t(tab.label)}</button>)}
    </div>
    {tabs.map((tab,index)=><div key={tab.label} id={`${id}-panel-${index}`} role="tabpanel" aria-labelledby={`${id}-tab-${index}`} hidden={selected!==index} className="provider-detail-workspace">{tab.content}</div>)}
  </div>;
}
