import type { CSSProperties } from "react";
import { surfaceMaterialStyle } from "../../design-system/surfaceMaterial";

import type { StageProvider } from "../../components/orbit/stageTypes";
import UsageWindowList from "../../components/orbit/UsageWindowList";
import {
  ArcGaugeV3,
  QaProviderIcon,
  formatPercentage,
  providerGlyphSize,
} from "../../design-system";
import type {
  FlowSurfaceSettings,
  FlowSurfaceState,
} from "../../design-system/flowSurface";
import { hasSurfaceQuotaValue } from "../../design-system/flowSurface";
import { CANONICAL_THEME, catalogBySlug, providerColor } from "../../design-system/themeCatalog";
import { providerMeterFillColor } from "../../design-system/meterFill";
import "./FlowSurface.css";
import ReelSurface from "../reel/ReelSurface";
import NotchSurface from "../notch/NotchSurface";
import { isNotchForm } from "../notch/notchGeometry";
import OfficialQuotaArcMark from '../../components/QuotaArcMark';

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
  demoMode?: boolean;
  /** Whether to show the "DEMO" watermark when `demoMode` is on. Defaults
   *  to true for real live surfaces (SurfacesTab's "Temporary demo"
   *  toggle) — set false for read-only preview contexts (StructurePreview,
   *  used by ThemeGallery/SurfacesTab's structure picker), which already
   *  use `demoMode` for synthetic fixture data but don't need a watermark
   *  the surrounding preview-card copy already makes redundant, and whose
   *  tiny scaled-down size made the watermark overlap the structure's own
   *  content (Wave 6 Phase 4 — reported directly by the owner). */
  showDemoBadge?: boolean;
}

function QuotaArcMark() {
  return <OfficialQuotaArcMark className="flow-surface__mark"/>;
}

/** Geometry and interaction stay independent of the selected material palette. */
function SurfaceProvider({
  provider,
  active,
  index,
  color,
  gaugeSize = 31,
  onFocus,
  onHover,
}: {
  provider: StageProvider;
  active: boolean;
  index: number;
  color: string;
  gaugeSize?: number;
  onFocus?: (index: number) => void;
  onHover?: (index: number) => void;
}) {
  return (
    <button
      type="button"
      className="flow-surface__provider"
      data-active={active}
      style={{ "--flow-provider": color, "--flow-gauge-size": `${gaugeSize}px` } as CSSProperties}
      onClick={() => onFocus?.(index)}
      onMouseEnter={() => onHover?.(index)}
      aria-pressed={active}
      aria-label={`${provider.name}: ${formatPercentage(provider.primaryValue)} ${provider.primaryLabel}`}
    >
      <span className="flow-surface__provider-gauge" aria-hidden="true">
        <ArcGaugeV3
          remaining={provider.arcFraction}
          size={gaugeSize}
          stroke={Math.max(2.5, gaugeSize * 0.1)}
          colorOverride={color}
          ariaLabel={`${provider.name} quota`}
        />
        <span className="flow-surface__provider-icon">
          <QaProviderIcon providerId={provider.iconId} size={providerGlyphSize(gaugeSize)} />
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
  demoMode,
  showDemoBadge = true,
}: FlowSurfaceProps) {
  if (isNotchForm(settings.form)) return <NotchSurface key={`${settings.form}:${settings.anchor}`} form={settings.form} {...{catalog, settings, state, providers, focusedIndex, onFocusProvider, onReveal, onToggleExpanded, onTogglePinned, onRequestCompact, onStartDrag, demoMode, showDemoBadge}} />;
  if (settings.form === "reel") return <ReelSurface {...{catalog, settings, state, providers, focusedIndex, onFocusProvider, onReveal, onToggleExpanded, onTogglePinned, onRequestCompact, onStartDrag, demoMode, showDemoBadge}} />;
  const theme = catalogBySlug(catalog) ?? CANONICAL_THEME;
  const visible = providers.filter(hasSurfaceQuotaValue).slice(0, 3);
  const focus = visible.length === 0 ? -1 : Math.min(Math.max(focusedIndex, 0), visible.length - 1);
  const focused = visible[focus];
  const hasQuotaData = visible.length > 0;
  const expanded = hasQuotaData && (state === "expanded" || state === "pinned");
  const scaleFactor = Math.min(1.25, Math.max(0.75, settings.scale / 100));
  const scaled = (pixels: number) => `${Math.round(pixels * scaleFactor)}px`;
  const style = {
    ...surfaceMaterialStyle(theme),
    "--flow-accent": theme.accent,
    "--flow-accent-soft": theme.hairline,
    "--flow-void": theme.bg[0],
    "--flow-void-strong": theme.core,
    "--flow-hairline": theme.coreEdge,
    "--flow-flowline-width": scaled(56),
    "--flow-flowline-radius": scaled(28),
    "--flow-horizon-height": scaled(58),
    "--flow-petal-width": scaled(170),
    "--flow-petal-height": scaled(118),
    "--flow-petal-details-width": scaled(214),
    "--flow-petal-details-height": scaled(140),
    "--flow-orbital-size": scaled(104),
    "--flow-orbital-empty-size": scaled(64),
    "--flow-orbital-details-width": scaled(244),
    "--flow-orbital-details-height": scaled(146),
    "--flow-lens-width": scaled(178),
    "--flow-lens-height": scaled(76),
    "--flow-lens-empty-width": scaled(76),
    "--flow-lens-empty-height": scaled(56),
    "--flow-lens-details-width": scaled(252),
    "--flow-lens-details-height": scaled(146),
    "--flow-details-width": scaled(238),
    "--flow-horizon-details-height": scaled(140),
  } as CSSProperties;

  if (state === "hidden") {
    return (
      <button
        type="button"
        className={`flow-surface__reveal flow-surface__reveal--${settings.form} flow-surface__reveal--${settings.anchor}`}
        style={style}
        onClick={onReveal}
        aria-label="Reveal Quotalis"
      >
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
      data-empty={!hasQuotaData}
      style={style}
      aria-label={`${settings.form} provider selector`}
    >
      <div className="flow-surface__core">
        {demoMode && showDemoBadge && <span className="flow-surface__demo" title="Synthetic data — not connected accounts">DEMO</span>}
        <button
          type="button"
          className="flow-surface__summary"
          onClick={hasQuotaData ? onToggleExpanded : undefined}
          disabled={!hasQuotaData}
          aria-expanded={expanded}
          aria-controls="quota-flow-details"
          aria-label={hasQuotaData
            ? `Expand ${focused?.name ?? "Quotalis"} details`
            : "Quotalis is waiting for provider data"}
        >
          {/* This icon is the application anchor — QuotaArc's own mark,
              never a provider glyph (Wave 6 Phase 4 correction: an earlier
              pass swapped this to the focused provider's icon, which read
              as "this app IS Claude/Gemini" instead of "QuotaArc, currently
              showing Gemini" — the provider's identity belongs in its own
              element, not by replacing the app's). */}
          <span className="flow-surface__brand"><QuotaArcMark /></span>
          <span className="flow-surface__summary-copy">
            <strong>{focused?.name ?? "Quotalis"}</strong>
            <small>{focused ? `${formatPercentage(focused.primaryValue)} ${focused.primaryLabel}` : "Waiting for provider data"}</small>
          </span>
        </button>
        <div className="flow-surface__quick-providers" aria-label="Provider status">
          {visible.map((provider, index) => (
            <SurfaceProvider
              key={provider.id}
              provider={provider}
              index={index}
              active={index === focus}
              color={providerColor(theme, provider.id)}
              gaugeSize={settings.form === "orbital" || settings.form === "lens" ? 25 : 31}
              onFocus={onFocusProvider}
              onHover={settings.interactions?.hoverDetails === false ? undefined : onFocusProvider}
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
          aria-label="Move Quotalis"
          title="Drag to move"
        >
          <span aria-hidden="true">⋮</span>
        </button>
      </div>

      {expanded && (
        <section id="quota-flow-details" className="flow-surface__details" role="dialog" aria-label={`${focused?.name ?? "Quotalis"} quota details`}>
          <header className="flow-surface__detail-header">
            {/* LEFT: the application anchor — logo only (Wave 6 Phase 4
                follow-up correction: the "QuotaArc" text label was removed
                to free header space for the provider identity below; the
                logo alone still reads as the app anchor, matching how the
                compact rail's brand icon already works with no text). */}
            <span className="flow-surface__detail-title" aria-label="Quotalis"><QuotaArcMark /></span>
            <span className="flow-surface__detail-controls">
              {/* A real pin glyph (Wave 6 Phase 4 follow-up correction —
                  ⌖ read as an ambiguous abstract symbol). Filled when
                  pinned, outline otherwise, matching the ⌖/× pair's
                  existing icon-button sizing. */}
              <button type="button" onClick={onTogglePinned} aria-pressed={state === "pinned"} aria-label={state === "pinned" ? "Unpin details" : "Pin details"}>
                <svg aria-hidden viewBox="0 0 16 16" width="13" height="13" fill={state === "pinned" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 1.5c-1.4 0-2.5 1.1-2.5 2.5 0 .9.3 1.9.7 2.7L4 9.8c-.3.4-.1 1 .4 1h3.1v3.2c0 .3.2.5.5.5s.5-.2.5-.5V10.8h3.1c.5 0 .7-.6.4-1l-2.2-3.1c.4-.8.7-1.8.7-2.7 0-1.4-1.1-2.5-2.5-2.5Z" />
                </svg>
              </button>
              <button type="button" onClick={onRequestCompact ?? onToggleExpanded} aria-label="Collapse details">×</button>
            </span>
          </header>
          {/* Focused provider identity — its own row below the header line
              (Wave 6 Phase 4 follow-up correction: previously shared the
              header's top line with the app logo and controls; moved lower
              and enlarged so it reads as the header's dominant content,
              still visually below the primary usage value in
              .flow-surface__detail-metrics). Two lines: the provider's own
              short display name (already concise — "Claude"/"Codex"/
              "Gemini", not a long account title, per the real StageProvider
              data model), then its real plan/package label when the
              provider snapshot reports one (StageProvider.planName,
              threaded from ProviderUsageSnapshot.planName — never
              fabricated; omitted entirely when absent). */}
          {focused && (
            <div className="flow-surface__detail-provider">
              <QaProviderIcon
                // The registry has no plain "openai" entry (only
                // "openaiapi"/"azureopenai" for the API-key provider) — the
                // ChatGPT/Codex CLI product's iconId is "openai" and maps
                // to the "codex" glyph, matching NotchDetails.tsx's
                // identical normalization.
                providerId={focused.iconId === "openai" ? "codex" : focused.iconId}
                size={20}
              />
              <span className="flow-surface__detail-provider-copy">
                <strong>{focused.name}</strong>
                {focused.planName && <small>{focused.planName}</small>}
              </span>
            </div>
          )}
          <div className="flow-surface__detail-body">
            <div className="flow-surface__detail-metrics">
              {focused?.windows ? <div style={{"--provider-color":providerMeterFillColor(providerColor(theme,focused.id),focused.limitPresentation?.identity,theme)} as CSSProperties}><UsageWindowList providerId={focused.id} windows={focused.windows} hidden={focused.detailsHidden} presentation={focused.limitPresentation}/></div> : <div className="flow-surface__metric">
                <strong>{formatPercentage(focused?.primaryValue)}</strong>
                <span>{focused?.primaryLabel ?? "unavailable"}</span>
                <small>Resets {focused?.reset ?? "—"}</small>
              </div>}
            </div>
            <div className="flow-surface__detail-providers" role="list" aria-label="Providers">
              {visible.map((provider, index) => (
                <SurfaceProvider
                  key={provider.id}
                  provider={provider}
                  index={index}
                  active={index === focus}
                  color={providerColor(theme, provider.id)}
                  gaugeSize={settings.form === "orbital" || settings.form === "lens" ? 25 : 31}
                  onFocus={onFocusProvider}
                  onHover={settings.interactions?.hoverDetails === false ? undefined : onFocusProvider}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </section>
  );
}
