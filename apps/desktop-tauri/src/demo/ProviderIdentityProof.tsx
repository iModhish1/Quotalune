import UsageWindowList from "../components/orbit/UsageWindowList";
import { PROVIDER_PRESENTATION_IDENTITIES } from "../design-system/limitPresentation";
import { providerMeterFillColor } from "../design-system/meterFill";
import type { StageUsageWindow } from "../components/orbit/stageTypes";
import "./ProviderIdentityProof.css";

const windows:StageUsageWindow[]=[
  {id:"five-hour",label:"5-hour",primaryValue:73,primaryLabel:"remaining",arcFraction:.73,reset:"3h 42m",resetsAt:null},
  {id:"weekly",label:"Weekly",primaryValue:41,primaryLabel:"remaining",arcFraction:.41,reset:"4d 9h",resetsAt:null},
];

export default function ProviderIdentityProof(){
  return <main className="provider-identity-proof"><header><span>PROVIDER PRESENTATION STUDIO</span><h1>Clear limits, independent identity</h1><p>Same provider data, sixteen visual identities. Structure and provider colors remain independent.</p></header><section>
    {PROVIDER_PRESENTATION_IDENTITIES.map(identity=><article key={identity} style={{"--provider-color":providerMeterFillColor("#10a37f",identity)} as React.CSSProperties}><h2>{identity}</h2><UsageWindowList providerId="codex" windows={windows} presentation={{shape:"ring",content:"both",direction:"forward",identity}}/></article>)}
  </section></main>;
}
