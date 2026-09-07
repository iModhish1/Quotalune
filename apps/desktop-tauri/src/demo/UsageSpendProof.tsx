import QuotaArcMark from '../components/QuotaArcMark';
import '../surfaces/settings/SettingsStudio.css';
import '../surfaces/settings/tabs/UsageSpendTab.css';

const metrics=[['Estimated spend','$48.72','Tracked locally'],['Price coverage','94%','2 models unpriced'],['Conversations','186','30-day window'],['Token mix','23.9B','Input · output · cached']];

export default function UsageSpendProof(){
  const params=new URLSearchParams(window.location.search);
  const theme=params.get('theme')==='light'?'light':'dark';
  return <div data-theme={theme} className="settings-surface--full">
    <main className="settings settings-studio" data-navigation="side">
      <header className="settings-studio-toolbar"><div className="settings-shell-brand"><span className="settings-shell-brand__mark"><QuotaArcMark size={32} label="Quotalis"/></span><span className="settings-shell-brand__copy"><span className="settings-shell-brand__name">Quotalis</span><h1>Usage &amp; Spend</h1></span></div><span className="settings-shell-actions">Synthetic visual proof</span></header>
      <nav className="settings-tabs" aria-label="Settings sections">{['General','Providers','Notifications','Menu Bar','Usage & Spend','Surfaces','Themes','Advanced','About'].map(label=><button type="button" className={`settings-tab${label==='Usage & Spend'?' settings-tab--active':''}`} key={label}><span className="settings-tab__icon">◦</span><span className="settings-tab__label">{label}</span></button>)}</nav>
      <div className="settings-body" data-tab="usageSpend">
        <section className="settings-section usage-spend">
          <header className="usage-spend__header"><div><span className="usage-spend__eyebrow">Quota intelligence</span><h3 className="settings-section__title settings-section__title--bold">Usage &amp; Spend</h3><p className="settings-section__caption">Usage, local estimates and activity—organized without taking over your workspace.</p></div><span className="usage-spend__live"><i/>Live local data</span></header>
          <div className="usage-spend__toolbar" aria-label="Usage and spend actions">{['Refresh','Share card','Copy JSON','Save JSON'].map(label=><button className="credential-btn credential-btn--secondary" key={label}>{label}</button>)}</div>
          <div className="usage-spend__filters"><div className="usage-spend__periods" role="group" aria-label="History period">{['7d','30d','All time'].map((label,index)=><button className="credential-btn credential-btn--secondary" aria-pressed={index===1} key={label}>{label}</button>)}</div><div className="usage-spend__imports"><label><input type="checkbox" defaultChecked/>Include Open Codex logs</label><label><input type="checkbox"/>Hide duplicate native cost</label></div></div>
          <div className="usage-spend__summary-style"><strong>Compact cost summary</strong><p className="settings-section__caption">Choose the detail shown on compact surfaces.</p><select className="settings-select" defaultValue="compact"><option value="compact">Compact</option><option>Detailed</option><option>Hidden</option></select></div>
          <div className="usage-spend__table-frame"><table className="usage-spend-table"><thead><tr><th>Provider</th><th>7 days</th><th>30 days</th><th>Currency</th><th>Source</th></tr></thead><tbody><tr><td>Codex</td><td>$12.90 · 4.8B tokens</td><td>$48.72 · 23.9B tokens</td><td>USD</td><td>Local logs</td></tr><tr><td>Claude</td><td>$8.40</td><td>$31.18</td><td>USD</td><td>OAuth usage</td></tr></tbody></table></div>
          <section className="usage-spend__insights"><div className="usage-spend__metric-grid">{metrics.map(([label,value,detail])=><article className="usage-spend__metric" key={label}><span className="settings-section__caption">{label}</span><strong>{value}</strong><span className="settings-section__caption">{detail}</span></article>)}</div><section className="usage-spend__heatmap"><h4>Hourly activity</h4><div className="usage-spend__heatmap-grid" aria-label="Hourly activity">{Array.from({length:168},(_,index)=><span key={index} style={{'--activity':.08+((index*17)%10)/13} as React.CSSProperties}/>)}</div></section></section>
          <section className="usage-spend__panel"><header className="usage-spend__panel-header"><div><h4>Models</h4><p className="settings-section__caption">Ranked by local activity</p></div></header><div className="usage-spend__ranked-list">{[['gpt-5.6-sol','9.8B tokens','$19.40'],['gpt-6-astra','6.1B tokens','$14.22'],['Claude Opus','3.7B tokens','$9.80'],['Gemini Pro','2.4B tokens','$5.30']].map(([name,tokens,cost])=><article className="usage-spend__ranked-item" key={name}><span><strong>{name}</strong><span className="settings-section__caption">{tokens}</span></span><span>{cost}</span></article>)}</div></section>
        </section>
      </div>
    </main>
  </div>;
}
