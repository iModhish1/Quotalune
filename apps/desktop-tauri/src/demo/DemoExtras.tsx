/**
 * Demo Floating HUD (Focus mode) and Dashboard hero — synthetic-only
 * surfaces for the visual review gate. Rendered inside the demo stage.
 */
import { ArcGaugeV3, QaValue, QaResetTime, QaStatusIndicator, statusOf, QaProviderIcon } from "../design-system";

const DEMO = [
  { id: "claude", name: "Claude", remaining: 0.73, session: 0.62, reset: "51m", pace: "1.2×" },
  { id: "codex", name: "Codex", remaining: 0.61, session: null, reset: "4d 4h", pace: "on track" },
  { id: "opencode", name: "OpenCode", remaining: 0.06, session: 0.11, reset: "2h 10m", pace: "1.8×" },
];

/** Floating HUD V2 — Focus mode: one provider as a beautiful instrument. */
export function HudFocus({ providerId = "claude" }: { providerId?: string }) {
  const p = DEMO.find((d) => d.id === providerId) ?? DEMO[0];
  const status = statusOf(p.remaining);
  const pct = Math.round(p.remaining * 100);
  return (
    <div className="qa-hud">
      <div className="qa-hud__arcwrap">
        <ArcGaugeV3 remaining={p.remaining} size={76} stroke={5} ariaLabel={`${p.name} ${pct}%`} />
        <span className="qa-hud__glyph" aria-hidden="true">
          <QaProviderIcon providerId={p.id} size={22} />
        </span>
      </div>
      <div className="qa-hud__arcval">
        <span className="qa-hud__big">{pct}</span>
        <span className="qa-hud__pctsign">%</span>
      </div>
      <div className="qa-hud__meta">
        <div className="qa-hud__name">
          <span className="qa-tico qa-tico--panel" aria-hidden="true">
            <QaProviderIcon providerId={p.id} size={16} />
          </span>
          <span>{p.name}</span>
          <QaStatusIndicator status={status} />
        </div>
        <div className="qa-hud__row">
          <span className="qa-hud__k">remaining</span>
          <QaValue size="meta">{pct}%</QaValue>
        </div>
        {p.session != null && (
          <div className="qa-hud__row">
            <span className="qa-hud__k">session</span>
            <QaValue size="meta">{Math.round(p.session * 100)}%</QaValue>
          </div>
        )}
        <div className="qa-hud__row">
          <span className="qa-hud__k">reset</span>
          <QaResetTime text={p.reset} />
        </div>
        <div className="qa-hud__row">
          <span className="qa-hud__k">pace</span>
          <QaValue size="meta">{p.pace}</QaValue>
        </div>
      </div>
    </div>
  );
}

/** Dashboard V2 hero — capacity first, then reset timeline and status. */
export function DashboardHero() {
  const best = [...DEMO].sort((a, b) => b.remaining - a.remaining)[0];
  const risk = [...DEMO].sort((a, b) => a.remaining - b.remaining)[0];
  return (
    <div className="qa-dash">
      <div className="qa-dash__hero">
        <div className="qa-dash__heroarcs">
          {DEMO.map((p) => {
            const pct = Math.round(p.remaining * 100);
            return (
              <div className="qa-dash__heroitem" key={p.id}>
                <div className="qa-dash__arcwrap">
                  <ArcGaugeV3 remaining={p.remaining} size={68} stroke={4.5} ariaLabel={`${p.name} ${pct}%`} />
                  <span className="qa-dash__glyph" aria-hidden="true">
                    <QaProviderIcon providerId={p.id} size={19} />
                  </span>
                  <span className="qa-dash__arcval">{pct}</span>
                </div>
                <span className="qa-dash__heroname">
                  <span className="qa-tico" aria-hidden="true">
                    <QaProviderIcon providerId={p.id} size={14} />
                  </span>
                  {p.name}
                </span>
              </div>
            );
          })}
        </div>
        <div className="qa-dash__callout">
          <span className="qa-dash__callout-k">best capacity</span>
          <QaValue size="lg">{Math.round(best.remaining * 100)}% · {best.name}</QaValue>
          <span className="qa-dash__callout-k" style={{ marginTop: 10 }}>
            needs attention
          </span>
          <QaValue size="md">
            <span style={{ color: "var(--qa-status-critical)" }}>
              {Math.round(risk.remaining * 100)}% · {risk.name}
            </span>
          </QaValue>
        </div>
      </div>
      <div className="qa-dash__timeline">
        <span className="qa-dash__tl-title">reset timeline</span>
        <div className="qa-dash__tlrow">
          <span className="qa-quick-panel__name">OpenCode</span>
          <div className="qa-dash__bar">
            <div className="qa-dash__barfill" style={{ width: "94%", background: "var(--qa-status-critical)" }} />
          </div>
          <QaResetTime text="2h 10m" />
        </div>
        <div className="qa-dash__tlrow">
          <span className="qa-quick-panel__name">Claude</span>
          <div className="qa-dash__bar">
            <div className="qa-dash__barfill" style={{ width: "38%" }} />
          </div>
          <QaResetTime text="51m" />
        </div>
        <div className="qa-dash__tlrow">
          <span className="qa-quick-panel__name">Codex</span>
          <div className="qa-dash__bar">
            <div className="qa-dash__barfill" style={{ width: "14%" }} />
          </div>
          <QaResetTime text="4d 4h" />
        </div>
      </div>
    </div>
  );
}
