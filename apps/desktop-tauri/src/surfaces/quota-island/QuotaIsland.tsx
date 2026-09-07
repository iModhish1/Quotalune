import type { CSSProperties } from "react";

import { ArcGaugeV3, QaProviderIcon, formatPercentage, providerGlyphSize } from "../../design-system";
import {
  CANONICAL_THEME,
  catalogBySlug,
  providerColor,
} from "../../design-system/themeCatalog";
import type { StageProvider } from "../../components/orbit/stageTypes";
import "./QuotaIsland.css";

export type QuotaIslandState = "compact" | "hover" | "expanded" | "pinned";

export interface QuotaIslandProps {
  catalog: string;
  state: QuotaIslandState;
  providers: StageProvider[];
  focusedIndex?: number;
  onFocusProvider?: (index: number) => void;
  onToggleExpanded?: () => void;
  onTogglePinned?: () => void;
  onStartDrag?: () => void;
  onRequestCompact?: () => void;
}

/**
 * The single, Windows-first QuotaArc overlay composition.
 *
 * This component deliberately owns no window geometry: Rust bounds the native
 * window and the island fills that bounded viewport. Future themes can swap
 * only token values; provider order, hierarchy, interaction and density stay
 * fixed here.
 */
export default function QuotaIsland({
  catalog,
  state,
  providers,
  focusedIndex = 0,
  onFocusProvider,
  onToggleExpanded,
  onTogglePinned,
  onStartDrag,
  onRequestCompact,
}: QuotaIslandProps) {
  const theme = catalogBySlug(catalog) ?? CANONICAL_THEME;
  const visibleProviders = providers.slice(0, 7);
  const boundedFocus = visibleProviders.length === 0
    ? -1
    : Math.min(Math.max(focusedIndex, 0), visibleProviders.length - 1);
  const focused = visibleProviders[boundedFocus];
  const expanded = state === "expanded" || state === "pinned";
  const style = {
    "--qi-accent": theme.accent,
    "--qi-accent-soft": `${theme.accent}33`,
    "--qi-core": theme.core,
    "--qi-core-edge": theme.coreEdge,
    "--qi-bg-start": theme.bg[0],
    "--qi-bg-end": theme.bg[1],
    "--qi-hairline": theme.hairline,
  } as CSSProperties;

  return (
    <section
      className="quota-island"
      data-state={state}
      data-theme={theme.slug}
      style={style}
      aria-label="Quotalis quota island"
    >
      <div
        className="quota-island__trigger"
      >
        <button
          type="button"
          className="quota-island__summary"
          aria-expanded={expanded}
          aria-controls="quota-island-details"
          aria-label={expanded ? "Collapse quota details" : "Expand quota details"}
          onClick={onToggleExpanded}
        >
          <span className="quota-island__brand" aria-hidden="true">Q</span>
          <span className="quota-island__trigger-copy">
            <span className="quota-island__provider-name">{focused?.name ?? "Quotalis"}</span>
            <span className="quota-island__provider-meta">
              {focused ? `${focused.primaryLabel} · ${focused.reset}` : "No provider data"}
            </span>
          </span>
          <span className="quota-island__trigger-gauge" aria-hidden="true">
            <ArcGaugeV3
              remaining={focused?.arcFraction ?? null}
              size={30}
              stroke={3.2}
              colorOverride={focused ? providerColor(theme, focused.iconId) : theme.accent}
              ariaLabel="Current quota arc"
            />
            {focused && <QaProviderIcon providerId={focused.iconId} size={providerGlyphSize(30)} />}
          </span>
          <span className="quota-island__trigger-value">{formatPercentage(focused?.primaryValue)}</span>
          <span className="quota-island__chevron" aria-hidden="true">⌄</span>
        </button>
        <button
          type="button"
          className="quota-island__drag"
          aria-label="Move Quota Island"
          title="Drag to move"
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            onStartDrag?.();
          }}
        >
          <span aria-hidden="true">⠿</span>
        </button>
      </div>

      {expanded && (
        <div id="quota-island-details" className="quota-island__details" role="dialog" aria-label="Quota details">
          <header className="quota-island__detail-header">
            <div>
              <p>Quota overview</p>
              <strong>{focused?.name ?? "No provider selected"}</strong>
            </div>
            <span className="quota-island__detail-actions">
              <button
                type="button"
                className="quota-island__pin"
                onClick={onTogglePinned}
                aria-pressed={state === "pinned"}
                aria-label={state === "pinned" ? "Unpin quota details" : "Pin quota details"}
                title={state === "pinned" ? "Unpin details" : "Keep details open"}
              >
                ⌖
              </button>
              <button
                type="button"
                className="quota-island__close"
                onClick={onRequestCompact ?? onToggleExpanded}
                aria-label="Collapse quota details"
              >
                ×
              </button>
            </span>
          </header>

          <div className="quota-island__focus">
            <span className="quota-island__focus-gauge" aria-hidden="true">
              <ArcGaugeV3
                remaining={focused?.arcFraction ?? null}
                size={66}
                stroke={4.8}
                colorOverride={focused ? providerColor(theme, focused.iconId) : theme.accent}
                ariaLabel="Focused quota arc"
              />
              {focused && <QaProviderIcon providerId={focused.iconId} size={providerGlyphSize(66)} />}
            </span>
            <div>
              <strong>{formatPercentage(focused?.primaryValue)}</strong>
              <span>{focused?.primaryLabel ?? "unavailable"}</span>
              <small>↻ {focused?.reset ?? "—"}</small>
            </div>
            {focused?.secondaryValue != null && (
              <span className="quota-island__secondary">
                {formatPercentage(focused.secondaryValue)} other window
              </span>
            )}
          </div>

          <div className="quota-island__providers" role="list" aria-label="Providers">
            {visibleProviders.map((provider, index) => {
              const active = index === boundedFocus;
              const color = providerColor(theme, provider.iconId);
              return (
                <button
                  key={provider.id}
                  type="button"
                  className="quota-island__provider"
                  data-active={active}
                  style={{ "--qi-provider": color } as CSSProperties}
                  onClick={() => onFocusProvider?.(index)}
                  aria-pressed={active}
                  aria-label={`${provider.name}: ${formatPercentage(provider.primaryValue)} ${provider.primaryLabel}`}
                >
                  <span className="quota-island__provider-icon">
                    <QaProviderIcon providerId={provider.iconId} size={16} />
                  </span>
                  <span className="quota-island__provider-copy">
                    <strong>{provider.name}</strong>
                    <small>{provider.reset}</small>
                  </span>
                  <span className="quota-island__provider-value">{formatPercentage(provider.primaryValue)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
