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
import { StructurePinButton } from "../../design-system/StructureControls";
import { structureDetailsMinContentHeight } from "../../design-system/structureGeometry";
import { useLocale } from "../../hooks/useLocale";

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
  /**
   * Wave 1D §10: true only during the very first provider fetch, before
   * any cached snapshot has ever loaded (`!useStageRuntime(...).hasLoadedCache`
   * in the real caller) — distinct from "loaded, but genuinely no quota
   * data" (providers disabled, none connected). Both cases currently
   * render through the same disabled compact-summary button (no data means
   * there is nothing to expand either way), but the message shown must not
   * conflate "waiting for the first answer" with "there is no answer".
   * Defaults to false so every existing demo/preview/test caller (which
   * never has a real loading phase) is unaffected.
   */
  initialLoading?: boolean;
  /**
   * Wave 1D §20-21: accessible keyboard alternative to pointer drag.
   * Called with a direction when the drag control has focus and an arrow
   * key is pressed; the real caller (TopArc.tsx) resolves this through
   * `nudgeStructureAnchor()` against the EXISTING `topArcAnchor` position
   * system (`lib/surfaceBridge.ts`) — no second, pixel-based position
   * store. Omit to leave arrow keys inert (e.g. read-only preview
   * contexts, which have nothing to persist a moved position into).
   */
  onNudge?: (direction: import("../../design-system/structureAnchorNudge").NudgeDirection) => void;
  /** Home key on the drag control — reuses the existing
   * `resetQuotaIslandPosition()` command, the same "Reset Position"
   * pointer-drag-era mechanism already persists through. */
  onResetPosition?: () => void;
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
  initialLoading = false,
  onNudge,
  onResetPosition,
}: FlowSurfaceProps) {
  const { t } = useLocale();
  if (isNotchForm(settings.form)) return <NotchSurface key={`${settings.form}:${settings.anchor}`} form={settings.form} {...{catalog, settings, state, providers, focusedIndex, onFocusProvider, onReveal, onToggleExpanded, onTogglePinned, onRequestCompact, onStartDrag, demoMode, showDemoBadge, initialLoading, onNudge, onResetPosition}} />;
  if (settings.form === "reel") return <ReelSurface {...{catalog, settings, state, providers, focusedIndex, onFocusProvider, onReveal, onToggleExpanded, onTogglePinned, onRequestCompact, onStartDrag, demoMode, showDemoBadge, initialLoading, onNudge, onResetPosition}} />;
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
    // Shared structure geometry contract (see structureGeometry.ts): a
    // content-driven floor the per-form tuned heights above are clamped
    // against via CSS max(), so a long provider/plan name or the "Resets
    // …" line is never silently clipped by .flow-surface__details'
    // overflow: hidden. The tuned values above still win whenever they are
    // already tall enough — this only grows the panel when real content
    // needs the room.
    "--flow-details-content-min-height": scaled(
      structureDetailsMinContentHeight({
        hasProviderIdentity: Boolean(focused),
        metricRows: focused?.windows ? 1 : 2,
      }),
    ),
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
            : initialLoading
              ? t("QuotalisStructureLoading")
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
            {/* Wave 1D §10: distinguishes "still fetching the first
                snapshot" from "loaded, genuinely nothing to show" — both
                previously rendered the identical "Waiting for provider
                data" text, so a user with zero enabled providers looked
                indistinguishable from one whose first fetch just hadn't
                returned yet. Same DOM shape either way — no silhouette
                resize (§10's "structure silhouette remains stable"). */}
            <small>
              {focused
                ? `${formatPercentage(focused.primaryValue)} ${focused.primaryLabel}`
                : initialLoading
                  ? t("QuotalisStructureLoading")
                  : "Waiting for provider data"}
            </small>
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
          onKeyDown={(event) => {
            // Wave 1D §20-21: pointer drag is not the only way to
            // reposition this structure. Arrow keys nudge one step through
            // the existing topArcAnchor position system; Home resets to
            // the predictable top-center position the same way
            // resetQuotaIslandPosition() already does for pointer users.
            const directionByKey: Record<string, "left" | "right" | "up" | "down"> = {
              ArrowLeft: "left",
              ArrowRight: "right",
              ArrowUp: "up",
              ArrowDown: "down",
            };
            const direction = directionByKey[event.key];
            if (direction && onNudge) {
              event.preventDefault();
              onNudge(direction);
            } else if (event.key === "Home" && onResetPosition) {
              event.preventDefault();
              onResetPosition();
            }
          }}
          aria-label="Move Quotalis"
          title={onNudge || onResetPosition ? t("StructureMoveHint") : "Drag to move"}
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
              {/* Shared StructurePinButton (design-system/StructureControls.tsx)
                  -- was a per-file real pin glyph here (Wave 6 Phase 4
                  follow-up correction: replaced an ambiguous ⌖ crosshair),
                  now the one canonical implementation every structure
                  render path shares, so this fix can't fail to propagate
                  to ReelSurface/NotchDetails again. */}
              <StructurePinButton pinned={state === "pinned"} onTogglePinned={onTogglePinned} />
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
