import { useMemo, useState } from "react";
import { ProviderIcon } from "../components/providers/ProviderIcon";

const providers = [
  ["codex", "Codex", "oauth", "42%"],
  ["claude", "Claude", "auto", "68%"],
  ["gemini", "Gemini", "cli", "55%"],
  ["copilot", "Copilot", "oauth", "81%"],
  ["cursor", "Cursor", "web", "34%"],
  ["openrouter", "OpenRouter", "api", "76%"],
] as const;

export default function ProviderWorkspaceProof() {
  const params = new URLSearchParams(window.location.search);
  const theme = params.get("theme") === "light" ? "light" : "dark";
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("codex");
  const visible = useMemo(
    () => providers.filter(([, name]) => name.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  const active = providers.find(([id]) => id === selected) ?? providers[0];

  return (
    <main data-theme={theme} className="provider-proof settings-body settings-body--providers">
      <div className="provider-split">
        <aside className="providers-sidebar-shell">
          <div className="providers-sidebar-search">
            <input
              className="providers-sidebar-search__input"
              type="search"
              aria-label="Search providers"
              placeholder="Search providers"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="providers-sidebar-summary" aria-hidden="true">
            <span className="providers-sidebar-summary__active">6</span><span>{visible.length}</span>
          </div>
          <ul className="providers-sidebar" role="listbox" aria-label="Providers">
            {visible.map(([id, name, source, percent], index) => (
              <li
                key={id}
                className={`providers-sidebar__row${selected === id ? " providers-sidebar__row--selected" : ""}`}
                role="option"
                aria-selected={selected === id}
                tabIndex={0}
                onClick={() => setSelected(id)}
              >
                <span className="providers-sidebar__status providers-sidebar__status--ok" />
                <ProviderIcon providerId={id} size={28} />
                <span className="providers-sidebar__text"><strong className="providers-sidebar__name">{name}</strong><span className="providers-sidebar__subtitle"><span>{source} · updated now</span><span className="providers-sidebar__subtitle-secondary">{percent}</span></span></span>
                <span className="providers-sidebar__handle" aria-hidden="true">⋮</span>
                <span className="providers-sidebar__reorder-controls"><button className="providers-sidebar__reorder-button" type="button" disabled={index === 0}>↑</button><button className="providers-sidebar__reorder-button" type="button" disabled={index === visible.length - 1}>↓</button></span>
                <input className="providers-sidebar__checkbox" type="checkbox" defaultChecked aria-label={`Enable ${name}`} />
              </li>
            ))}
          </ul>
        </aside>
        <section className="provider-detail">
          <header className="provider-detail-header-block">
            <div className="provider-detail-header"><ProviderIcon providerId={active[0]} size={28} /><div className="provider-detail-title-group"><strong className="provider-detail-title">{active[1]}</strong><span className="provider-detail-subtitle">Connected · updated just now</span></div></div>
            <dl className="provider-detail-grid"><div><dt>Plan</dt><dd>Pro</dd></div><div><dt>Source</dt><dd>{active[2]}</dd></div></dl>
          </header>
          <div className="provider-detail-overview">
            <section className="provider-detail-section"><h4>Usage</h4>{[["Session",84],["5-hour",42],["Weekly",58],["Model limit",21]].map(([label,value]) => <div className="provider-usage-bar" key={label}><div className="provider-usage-bar__header"><span className="provider-usage-bar__label">{label}</span><strong className="provider-usage-bar__pct">{value}% remaining</strong></div><div className="provider-usage-bar__track"><div className="provider-usage-bar__fill" style={{width:`${value}%`}} /></div><span className="provider-usage-bar__reset">Resets on schedule</span></div>)}</section>
            <section className="provider-detail-section"><h4>Quick actions</h4><div className="provider-detail-actions"><button className="btn btn--primary" type="button">Sign in</button><button className="btn btn--ghost" type="button">Refresh</button><button className="btn btn--ghost" type="button">Dashboard</button><button className="btn btn--ghost" type="button">Status</button></div></section>
          </div>
          <div className="provider-detail-workspace">
            <section className="provider-detail-section"><h4>Visible limits</h4><label className="provider-detail-toggle"><input type="checkbox" defaultChecked /><span><strong>Session</strong><small>Independent item · first</small></span></label><label className="provider-detail-toggle"><input type="checkbox" defaultChecked /><span><strong>5-hour</strong><small>Independent item · second</small></span></label><label className="provider-detail-toggle"><input type="checkbox" defaultChecked /><span><strong>Weekly</strong><small>Independent item · third</small></span></label></section>
            <section className="provider-detail-section"><h4>Indicator</h4><label className="provider-detail-field"><span className="provider-detail-field__label">Presentation</span><select className="provider-detail-select" defaultValue="ring"><option value="ring">Ring + percent</option><option>Bar only</option></select></label><p className="provider-detail-helper">Choose the visual treatment without changing tracked limits.</p></section>
            <section className="provider-detail-section"><h4>Connection</h4><p className="provider-detail-helper">Credentials remain local and can be replaced or revoked here.</p><div className="provider-detail-actions"><button className="btn btn--ghost" type="button">Switch account</button><button className="btn btn--ghost" type="button">Revoke</button></div></section>
            <section className="provider-detail-section"><h4>Provider color</h4><p className="provider-detail-helper">A provider accent is separate from the application theme.</p><input type="color" defaultValue="#19b69a" aria-label="Provider color" /></section>
          </div>
        </section>
      </div>
    </main>
  );
}
