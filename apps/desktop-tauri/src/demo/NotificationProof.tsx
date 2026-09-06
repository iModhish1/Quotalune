import {useEffect,useState} from "react";
import NotificationPreview from "../surfaces/settings/NotificationPreview";
import {ThresholdOverrideInputs} from "../surfaces/settings/tabs/GeneralTab";
import type {UsageThresholdOverride} from "../types/bridge";
import "../surfaces/settings/SettingsStudio.css";

/** Actual production controls; local fixture state only, never native settings. */
export default function NotificationProof(){
  const [appearance,setAppearance]=useState(()=>new URLSearchParams(window.location.search).get("theme")==="light"?"light":"dark");
  const [overrides,setOverrides]=useState<Record<string,UsageThresholdOverride>>({});
  const [events,setEvents]=useState<Record<string,boolean>>({predictive:false,high:true,critical:true,exhausted:true,status:true,depleted:true,restored:true,expectedReset:true,unexpectedReset:true,bankedReset:true});
  const [step,setStep]=useState<number|undefined>(10);
  useEffect(()=>{
    const root=document.documentElement;
    const previous=root.dataset.theme;
    root.dataset.theme=appearance;
    return()=>{
      if(previous)root.dataset.theme=previous;
      else delete root.dataset.theme;
    };
  },[appearance]);
  return <div data-theme={appearance}><main className="settings settings-studio" style={{display:"block",height:"auto",overflow:"visible",background:appearance==="light"?"#f2f4f7":"#101113",color:appearance==="light"?"#203344":"#e5e7eb",padding:20,fontFamily:"Segoe UI,sans-serif",minHeight:"100vh",boxSizing:"border-box"}}>
    <h1 style={{fontSize:22}}>Notification controls · visual proof</h1>
    <p>Synthetic settings · no notifications sent · changes are not saved</p>
    <label>Preview appearance <select aria-label="Notification preview appearance" value={appearance} onChange={e=>setAppearance(e.target.value)}><option value="dark">Dark</option><option value="light">Light</option></select></label>
    <NotificationPreview high={80} critical={90} enabled={false}/>
    <section className="settings-section">
      <div className="notification-event-selector__heading"><strong>Alert categories</strong><small>Independent synthetic controls · master state and choices are demonstrated without saving</small></div>
      <div className="notification-event-grid">
        {[
          ["predictive","Predictive pace","Forecasts exhaustion before reset","notice"],
          ["high","Early warning","Usage crosses the first threshold","warning"],
          ["critical","Critical warning","Very little quota remains","critical"],
          ["exhausted","Limit exhausted","A tracked limit reaches zero","critical"],
          ["status","Provider incident","A provider reports a service problem","warning"],
          ["depleted","Session depleted","The active session has no quota","critical"],
          ["restored","Quota restored","A depleted session becomes available","positive"],
          ["expectedReset","Scheduled reset","Quota resets at its announced boundary","positive"],
          ["unexpectedReset","Unexpected reset","Quota resets early or without a schedule","warning"],
          ["bankedReset","Banked reset credit","Available reset-credit count increases","positive"],
        ].map(([key,label,description,tone])=><article key={key} className="notification-event-card" data-tone={tone} data-enabled={events[key]}>
          <span className="notification-event-card__signal" aria-hidden="true"/><div><strong>{label}</strong><small>{description}</small></div>
          <input className="toggle" type="checkbox" aria-label={label} checked={events[key]} onChange={event=>setEvents(current=>({...current,[key]:event.target.checked}))}/>
        </article>)}
        <article className="notification-event-card" data-tone="notice" data-enabled={Boolean(step)}>
          <span className="notification-event-card__signal" aria-hidden="true"/><div><strong>Usage milestones</strong><small>Notify after every custom consumption step</small></div>
          <div className="notification-step-control"><input className="toggle" type="checkbox" aria-label="Usage milestones" checked={Boolean(step)} onChange={event=>setStep(event.target.checked?10:undefined)}/>{step&&<input className="number-input" type="number" min="1" max="100" aria-label="Milestone interval percentage" value={step} onChange={event=>setStep(Number(event.target.value))}/>}</div>
        </article>
      </div>
    </section>
    <section className="settings-section notification-overrides">
      <h2 style={{fontSize:16}}>Provider &amp; limit overrides</h2>
      <p>Empty fields inherit. Each card shows used and remaining equivalents.</p>
      <div className="notification-overrides__grid">
        {["Codex","Codex · Session","Codex · Weekly","Claude","Claude · Session","Claude · Weekly"].map(label=>
          <ThresholdOverrideInputs key={label} label={label} value={overrides[label]??{}} inheritedHigh={80} inheritedCritical={90}
            highLabel="Early warning" criticalLabel="Critical warning" disabled={false} onChange={value=>setOverrides(previous=>({...previous,[label]:value}))}/>
        )}
      </div>
    </section>
  </main></div>;
}
