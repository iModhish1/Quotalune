import QuotaArcMark from "../components/QuotaArcMark";
import NotificationPreview from "../surfaces/settings/NotificationPreview";
import NavigationPreference from "../surfaces/settings/NavigationPreference";
import type {SettingsNavigation} from "../surfaces/settings/settingsNavigation";
import "../surfaces/settings/SettingsStudio.css";

const tabs=["General","Providers","Notifications","Menu Bar","Menu","Usage & Spend","Surfaces","Themes","Advanced","About"];

function ProofSection({title,rows=3}:{title:string;rows?:number}){
  return <section className="settings-section">
    <h2 className="settings-section__title">{title}</h2>
    <p className="settings-section__description">Real shell geometry proof · representative controls only.</p>
    <div className="settings-section__group">
      {Array.from({length:rows},(_,index)=><div className="settings-field" key={index}>
        <div className="settings-field__text"><strong className="settings-field__label">Control {index+1}</strong><span className="settings-field__desc">A concise explanation remains directly beneath its control.</span></div>
        <div className="settings-field__control"><input className="toggle" type="checkbox" defaultChecked={index%2===0} aria-label={`${title} control ${index+1}`}/></div>
      </div>)}
    </div>
  </section>;
}

export default function SettingsLayoutProof(){
  const params=new URLSearchParams(window.location.search);
  const navigation=(params.get("nav")==="top"||params.get("nav")==="bottom"?params.get("nav"):"side") as SettingsNavigation;
  const tab=params.get("tab")==="notifications"?"notifications":params.get("tab")==="advanced"?"advanced":"general";
  const theme=params.get("theme")==="light"?"light":"dark";
  const sections=tab==="advanced"?["Keyboard","Diagnostics","Network","Privacy","Performance","Experimental"]:["Application theme","Startup","Language","Identity"];
  return <div data-theme={theme} className="settings-surface--full">
    <main className="settings settings-studio" data-navigation={navigation}>
      <header className="settings-studio-toolbar">
        <div className="settings-shell-brand"><span className="settings-shell-brand__mark"><QuotaArcMark size={32} label="Quotalis"/></span><span className="settings-shell-brand__copy"><span className="settings-shell-brand__name">Quotalis</span><h1>{tab}</h1></span></div>
        <div className="settings-shell-actions"><span>Responsive layout proof</span></div>
      </header>
      <nav className="settings-tabs" aria-label="Settings sections">
        {tabs.map(label=><button className={`settings-tab${label.toLowerCase()===tab?" settings-tab--active":""}`} type="button" key={label}><span className="settings-tab__icon">◦</span><span className="settings-tab__label">{label}</span></button>)}
      </nav>
      <div className="settings-body" data-tab={tab}>
        {tab==="general"&&<NavigationPreference value={navigation} onChange={()=>{}}/>}
        {tab==="notifications"&&<NotificationPreview high={80} critical={90} enabled/>}
        {tab==="notifications"&&<><ProofSection title="Alert categories" rows={4}/><ProofSection title="Provider and limit overrides" rows={4}/><ProofSection title="Quiet hours and sound" rows={3}/><ProofSection title="Global thresholds" rows={3}/></>}
        {tab!=="notifications"&&sections.map(title=><ProofSection title={title} key={title}/>) }
      </div>
    </main>
  </div>;
}
