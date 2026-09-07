import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { surfaceMaterialStyle } from "../../design-system/surfaceMaterial";
import { ArcGaugeV3, QaProviderIcon, formatPercentage, providerGlyphSize } from "../../design-system";
import type { FlowSurfaceProps } from "../flow-surface/FlowSurface";
import { reelBaseSize, reelOffset, reelPoint, wheelStep } from "./reelGeometry";
import "./ReelSurface.css";
import UsageWindowList from "../../components/orbit/UsageWindowList";
import QuotaArcMark from '../../components/QuotaArcMark';
import { CANONICAL_THEME, catalogBySlug, providerColor } from "../../design-system/themeCatalog";

/** A curved provider selector, not a clock. No ticking or permanent animation. */
export default function ReelSurface({ catalog, settings, state, providers, focusedIndex = 0, demoMode, showDemoBadge = true,
  onFocusProvider, onReveal, onToggleExpanded, onRequestCompact, onTogglePinned, onStartDrag,
}: FlowSurfaceProps) {
  const demoLabel = demoMode && showDemoBadge;
  const theme = catalogBySlug(catalog) ?? CANONICAL_THEME;
  const root = useRef<HTMLElement>(null);
  const wheel = useRef({ sum: 0, lastAt: -Infinity });
  const horizontal = settings.anchor === "top" || settings.anchor === "bottom";
  const expanded = providers.length > 0 && (state === "expanded" || state === "pinned");
  const size = reelBaseSize(expanded ? "expanded" : state === "hidden" || state === "peek" ? "hidden" : "compact", horizontal);
  const [fit, setFit] = useState(settings.scale / 100);
  const focus = Math.max(0, Math.min(focusedIndex, providers.length - 1));
  const selected = providers[focus];
  const cycle = (step: number) => {
    if (providers.length > 1) onFocusProvider?.((focus + step + providers.length) % providers.length);
  };
  useLayoutEffect(() => {
    if (!root.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0)
        setFit(Math.min(entry.contentRect.width / size.width, entry.contentRect.height / size.height));
    });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [size.width, size.height]);

  return <section ref={root} className="reel-host" aria-label="Orbit Reel provider selector"
    style={{...surfaceMaterialStyle(theme),"--provider-color":selected?providerColor(theme,selected.id):theme.accent} as CSSProperties}
    onWheel={(event) => {
      if (event.ctrlKey || providers.length < 2 || settings.interactions?.wheelCycle===false) return;
      const delta = (Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX)
        * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 208 : 1);
      const next = wheelStep(wheel.current, delta, performance.now());
      wheel.current = next.state;
      if (next.step) cycle(next.step);
    }}
    onKeyDown={(event) => {
      if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End", "Escape"].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        if (event.key === "Home") onFocusProvider?.(0);
        else if (event.key === "End") onFocusProvider?.(Math.max(0, providers.length - 1));
        else if (event.key === "Escape") onRequestCompact?.();
        else cycle(event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1);
      }
    }}>
    <div className="reel-stage" data-anchor={settings.anchor} data-horizontal={horizontal}
      style={{ width: size.width, height: size.height, transform: `scale(${fit})` }}>
      {state === "hidden" || state === "peek" ? <button className="reel-reveal" onClick={onReveal}
        aria-label="Reveal Quotalis" title={demoLabel ? "Quotalis · Demo data" : "Quotalis"}>
        <QuotaArcMark size={20}/>
      </button> : <>
        <div className="reel-core">
          <svg className="reel-track" viewBox={horizontal ? "0 0 208 112" : "0 0 112 208"} aria-hidden="true">
            <path d={horizontal ? "M22 82 C58 12 150 12 186 82" : "M82 22 C12 58 12 150 82 186"} />
          </svg>
          <span className="reel-mode">{demoLabel ? "DEMO" : "QUOTA"}</span>
          {providers.map((provider, index) => {
            const offset = reelOffset(index, focus, providers.length);
            const visible = Math.abs(offset) <= 1;
            const p = reelPoint(offset, horizontal);
            if (!horizontal && settings.anchor.includes("left")) p.x = 112 - p.x;
            if (horizontal && settings.anchor === "bottom") p.y = 112 - p.y;
            return <button key={provider.id} className="reel-node" data-active={offset === 0}
              aria-hidden={!visible} tabIndex={visible ? 0 : -1} disabled={!visible}
              aria-label={`${provider.name}: ${formatPercentage(provider.primaryValue)} ${provider.primaryLabel}`}
              aria-pressed={offset === 0}
              aria-expanded={offset === 0 ? expanded : undefined}
              onMouseEnter={() => {
                if (settings.interactions?.hoverDetails !== false) onFocusProvider?.(index);
              }}
              onClick={() => offset === 0 ? onToggleExpanded?.() : onFocusProvider?.(index)}
              style={{ "--node-x": `${p.x}px`, "--node-y": `${p.y}px`, "--node-scale": offset === 0 ? 1 : 0.64,
                opacity: visible ? offset === 0 ? 1 : 0.52 : 0 } as CSSProperties}>
              <span className="reel-gauge">
                <ArcGaugeV3 remaining={provider.arcFraction} size={46} stroke={2.5} colorOverride={providerColor(theme, provider.id)} ariaLabel={`${provider.name} quota`} />
                <QaProviderIcon providerId={provider.iconId === "openai" ? "codex" : provider.iconId} size={providerGlyphSize(46)} />
              </span>
              <span className="reel-value">{formatPercentage(provider.primaryValue)}</span>
            </button>;
          })}
          {!selected && <span className="reel-empty">No quota data</span>}
          <span className="reel-caption" aria-live="polite">{selected?.name ?? "Quotalis"}<small>{providers.length ? `${focus + 1} / ${providers.length}` : "—"}</small></span>
          <button className="reel-drag" aria-label="Move Quotalis" title="Drag to move"
            onMouseDown={e => { if (e.button === 0) { e.preventDefault(); onStartDrag?.(); } }}>⠿</button>
        </div>
        {expanded && selected && <section className="reel-details" role="dialog" aria-label={`${selected.name} quota details`}>
          <header><span>{demoLabel ? "DEMO · SYNTHETIC" : "USAGE"}</span><button onClick={onRequestCompact} aria-label="Collapse details">×</button></header>
          <strong className="reel-detail-name">{selected.name}</strong>
          {selected.windows ? <UsageWindowList providerId={selected.id} windows={selected.windows} hidden={selected.detailsHidden} presentation={selected.limitPresentation}/> : <><div className="reel-detail-value">{formatPercentage(selected.primaryValue)}<small>{selected.primaryLabel}</small></div>
          <div className="reel-progress" role="meter" aria-label={`${selected.name} ${selected.primaryLabel}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={selected.primaryValue ?? undefined}>
            <i style={{ width: `${Math.max(0, Math.min(1, selected.arcFraction ?? 0)) * 100}%` }} />
          </div>
          <p>Resets in {selected.reset}</p></>}
          <footer><button onClick={() => cycle(-1)} aria-label="Previous provider">‹</button><span>{focus + 1} / {providers.length}</span><button onClick={() => cycle(1)} aria-label="Next provider">›</button><button onClick={onTogglePinned} aria-pressed={state === "pinned"} aria-label="Pin details">⌖</button></footer>
        </section>}
      </>}
    </div>
  </section>;
}
