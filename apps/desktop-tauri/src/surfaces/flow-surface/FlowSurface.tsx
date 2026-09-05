import type { CSSProperties } from "react";

import type { StageProvider } from "../../components/orbit/stageTypes";
import {
  ArcGaugeV3,
  QaProviderIcon,
  formatPercentage,
} from "../../design-system";
import type {
  FlowSurfaceSettings,
  FlowSurfaceState,
} from "../../design-system/flowSurface";
import { CANONICAL_THEME, catalogBySlug } from "../../design-system/themeCatalog";
import "./FlowSurface.css";

export interface FlowSurfaceProps {
  catalog: string;
  settings: FlowSurfaceSettings;
  state: FlowSurfaceState;
  providers: StageProvider[];
  focusedIndex?: number;
  onFocusProvider?: (index: number) => void;
  onReveal?: () => void;
  onToggleExpanded?: () => void;
  onTogglePinned?: () => void;
  onRequestCompact?: () => void;
  onStartDrag?: () => void;
}

function QuotaArcMark() {
  return (
    <svg className="flow-surface__mark" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M7 20.5C8.8 12.1 14.8 7.4 23.7 8.4" />
      <path d="M8.5 24C14.7 26.2 22.5 22.2 24.5 14.2" />
      <circle cx="18.3" cy="16.2" r="2.2" />
    </svg>
  );
}

/**
 * The foundation is intentionally material-first: provider identity comes
 * from its icon and label, not a row of competing neon colours. Future
 * materials can replace this restrained silver scale without touching the
 * interaction or layout contract.
 */
function providerTone(index: number, materialSlug: string): string {
  const obsidianVoid = ["#e4e7eb", "#b9c0c9", "#9099a6", "#707986"];
  const fallback = ["#d8dde4", "#b4bac4", "#9099a6", "#747d89"];
  const tones = materialSlug === CANONICAL_THEME.slug ? obsidianVoid : fallback;
  return tones[index % tones.length];
}

function SurfaceProvider({
  provider,
  active,
  index,
  color,
  onFocus,
}: {
  provider: StageProvider;
  active: boolean;
  index: number;
  color: string;
  onFocus?: (index: number) => void;
}) {
  return (
    <button
      type="button"
      className="flow-surface__provider"
      data-active={active}
      style={{ "--flow-provider": color } as CSSProperties}
      onClick={() => onFocus?.(index)}
      aria-pressed={active}
      aria-label={`${provider.name}: ${formatPercentage(provider.primaryValue)} ${provider.primaryLabel}`}
    >
      <span className="flow-surface__provider-gauge" aria-hidden="true">
        <ArcGaugeV3
          remaining={provider.arcFraction}
          size={31}
          stroke={3.1}
          colorOverride={color}
          ariaLabel={`${provider.name} quota`}
        />
        <span className="flow-surface__provider-icon">
          <QaProviderIcon providerId={provider.iconId} size={12} />
        </span>
      </span>
      <span className="flow-surface__provider-value">{formatPercentage(provider.primaryValue)}</span>
    </button>
  );
}

/**
 * One compact, shape-switchable Windows surface. Forms only rearrange the
 * same provider data; materials and palette remain supplied by the theme.
 */
export default function FlowSurface({
  catalog,
  settings,
  state,
  providers,
  focusedIndex = 0,
  onFocusProvider,
  onReveal,
  onToggleExpanded,
  onTogglePinned,
  onRequestCompact,
  onStartDrag,
}: FlowSurfaceProps) {
  const theme = catalogBySlug(catalog) ?? CANONICAL_THEME;
  const visible = providers.slice(0, 3);
  const focus = visible.length === 0 ? -1 : Math.min(Math.max(focusedIndex, 0), visible.length - 1);
  const focused = visible[focus];
  const expanded = state === "expanded" || state === "pinned";
  const style = {
    "--flow-accent": "#d8dde4",
    "--flow-accent-soft": "rgba(216, 221, 228, 0.22)",
    "--flow-void": "rgba(4, 5, 8, 0.88)",
    "--flow-void-strong": "rgba(1, 2, 4, 0.96)",
    "--flow-hairline": "rgba(221, 227, 235, 0.18)",
  } as CSSProperties;

  if (state === "hidden") {
    return (
      <button type="button" className={`flow-surface__reveal flow-surface__reveal--${settings.form}`} onClick={onReveal} aria-label="Reveal QuotaArc">
        <QuotaArcMark />
      </button>
    );
  }

  return (
    <section
      className="flow-surface"
      data-testid="flow-surface"
      data-form={settings.form}
      data-anchor={settings.anchor}
      data-state={state}
      data-empty={visible.length === 0}
      style={style}
      aria-label="QuotaArc compact quota surface"
    >
      <div className="flow-surface__core">
        <button
          type="button"
          className="flow-surface__summary"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          aria-controls="quota-flow-details"
          aria-label={`Expand ${focused?.name ?? "QuotaArc"} details`}
        >
          <span className="flow-surface__brand"><QuotaArcMark /></span>
          <span className="flow-surface__summary-copy">
            <strong>{focused?.name ?? "QuotaArc"}</strong>
            <small>{focused ? `${formatPercentage(focused.primaryValue)} ${focused.primaryLabel}` : "No quota data"}</small>
          </span>
        </button>
        <div className="flow-surface__quick-providers" aria-label="Provider status">
          {visible.map((provider, index) => (
            <SurfaceProvider
              key={provider.id}
              provider={provider}
              index={index}
              active={index === focus}
              color={providerTone(index, theme.slug)}
              onFocus={onFocusProvider}
            />
          ))}
        </div>
        <button
          type="button"
          className="flow-surface__drag"
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            onStartDrag?.();
          }}
          aria-label="Move QuotaArc"
          title="Drag to move"
        >
          <span aria-hidden="true">⋮</span>
        </button>
      </div>

      {expanded && (
        <section id="quota-flow-details" className="flow-surface__details" role="dialog" aria-label={`${focused?.name ?? "QuotaArc"} quota details`}>
          <header className="flow-surface__detail-header">
            <span className="flow-surface__detail-title"><QuotaArcMark /> <strong>{focused?.name ?? "QuotaArc"}</strong></span>
            <span>
              <button type="button" onClick={onTogglePinned} aria-pressed={state === "pinned"} aria-label={state === "pinned" ? "Unpin details" : "Pin details"}>⌖</button>
              <button type="button" onClick={onRequestCompact ?? onToggleExpanded} aria-label="Collapse details">×</button>
            </span>
          </header>
          <div className="flow-surface__metric">
            <strong>{formatPercentage(focused?.primaryValue)}</strong>
            <span>{focused?.primaryLabel ?? "unavailable"}</span>
            <small>Resets {focused?.reset ?? "—"}</small>
          </div>
          <div className="flow-surface__detail-providers" role="list" aria-label="Providers">
            {visible.map((provider, index) => (
              <SurfaceProvider
                key={provider.id}
                provider={provider}
                index={index}
                active={index === focus}
                color={providerTone(index, theme.slug)}
                onFocus={onFocusProvider}
              />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
