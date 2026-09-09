/**
 * Phase S1: one "Provider Instrument Node" in the Spatial Observatory --
 * a semantic `<button>`, never a Canvas/WebGL-drawn shape (owner section
 * 8/47). Housing is always a neutral structural material (obsidian/
 * titanium/slate, from the resolved Structure Theme); the provider's own
 * identity color is used ONLY for local accents -- the glyph, the usage
 * gauge arc, the reset tick, and the selected-state focus ring (owner
 * section 7) -- never as a fill for the whole node.
 */
import { getProviderIcon } from "../../../components/providers/providerIcons";
import { formatPercentage } from "../../../design-system/percent";
import type { ProviderSceneNode } from "../providers3d/sceneModel";
import { isResetSoon } from "../providers3d/resetProximity";
import type { SpatialNodeLayout } from "./spatialLayout";
import "./ProviderInstrumentNode.css";

const GAUGE_SIZE = 96;
const GAUGE_STROKE = 6;
const GAUGE_RADIUS = (GAUGE_SIZE - GAUGE_STROKE) / 2;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

function ProviderGlyph({ providerId, colorHex }: { providerId: string; colorHex: string }) {
  const icon = getProviderIcon(providerId);
  if (icon.svgPath) {
    return (
      <span
        className="spatial-node__glyph"
        style={{ color: colorHex }}
        aria-hidden="true"
        // eslint-disable-next-line react/no-danger -- SVGs are bundled locally, no user input (same as ProviderIcon.tsx).
        dangerouslySetInnerHTML={{ __html: icon.svgPath }}
      />
    );
  }
  return (
    <span className="spatial-node__glyph spatial-node__glyph--letter" style={{ color: colorHex }} aria-hidden="true">
      {icon.fallbackLetter}
    </span>
  );
}

export interface ProviderInstrumentNodeProps {
  node: ProviderSceneNode;
  layout: SpatialNodeLayout;
  isSelected: boolean;
  isHovered: boolean;
  showLabel: boolean;
  onSelect: (id: string) => void;
  onHoverChange: (id: string | null) => void;
  reducedMotion: boolean;
}

export default function ProviderInstrumentNode({
  node,
  layout,
  isSelected,
  isHovered,
  showLabel,
  onSelect,
  onHoverChange,
  reducedMotion,
}: ProviderInstrumentNodeProps) {
  const usedFraction = (node.usedPercent ?? 0) / 100;
  const dashOffset = GAUGE_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, usedFraction)));
  const resetSoon = isResetSoon(node.resetsAt);
  const statusClass =
    node.alertLevel === "critical"
      ? "spatial-node--critical"
      : node.alertLevel === "warning"
        ? "spatial-node--warning"
        : node.authState !== "ready"
          ? "spatial-node--auth"
          : "";

  const scale = layout.scale * (isHovered && !isSelected ? 1.03 : 1);
  const translateZ = -layout.depth * 240;
  const depthBlur = layout.depth > 0.55 ? (layout.depth - 0.55) * 3 : 0;
  const depthOpacity = 1 - layout.depth * 0.22;

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      className={`spatial-node${isSelected ? " spatial-node--selected" : ""}${statusClass ? ` ${statusClass}` : ""}`}
      style={{
        left: `${layout.x}%`,
        top: `${layout.y}%`,
        // `translate(-50%, -50%)` centers the node on its own x/y anchor
        // point before applying depth (`translateZ`) and hover/selection
        // (`scale`) -- CSS handles the transition itself (see
        // ProviderInstrumentNode.css); reduced motion is honored via the
        // `data-qa-motion` attribute on the stage container, not here.
        transform: `translate(-50%, -50%) translateZ(${translateZ}px) scale(${scale})`,
        zIndex: Math.round((1 - layout.depth) * 100) + (isSelected ? 200 : 0),
        opacity: depthOpacity,
        filter: depthBlur > 0 ? `blur(${depthBlur.toFixed(2)}px)` : undefined,
        ["--spatial-node-accent" as string]: node.identityColorHex,
      }}
      onClick={() => onSelect(node.id)}
      onMouseEnter={() => onHoverChange(node.id)}
      onMouseLeave={() => onHoverChange(null)}
      onFocus={() => onHoverChange(node.id)}
      onBlur={() => onHoverChange(null)}
      data-qa-motion={reducedMotion ? "reduced" : "full"}
      data-provider-id={node.id}
      data-tier={layout.tier}
    >
      <span className="spatial-node__housing">
        <svg
          className="spatial-node__gauge"
          width={GAUGE_SIZE}
          height={GAUGE_SIZE}
          viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`}
          aria-hidden="true"
        >
          <circle
            className="spatial-node__gauge-track"
            cx={GAUGE_SIZE / 2}
            cy={GAUGE_SIZE / 2}
            r={GAUGE_RADIUS}
            strokeWidth={GAUGE_STROKE}
            fill="none"
          />
          <circle
            className="spatial-node__gauge-arc"
            cx={GAUGE_SIZE / 2}
            cy={GAUGE_SIZE / 2}
            r={GAUGE_RADIUS}
            strokeWidth={GAUGE_STROKE}
            fill="none"
            strokeDasharray={GAUGE_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ stroke: node.identityColorHex }}
          />
          {resetSoon && (
            <line
              className="spatial-node__reset-tick"
              x1={GAUGE_SIZE / 2}
              y1={GAUGE_STROKE * 0.2}
              x2={GAUGE_SIZE / 2}
              y2={GAUGE_STROKE * 1.6}
            />
          )}
        </svg>
        <ProviderGlyph providerId={node.id} colorHex={node.identityColorHex} />
        {node.alertLevel !== "none" && (
          <span className={`spatial-node__status-dot spatial-node__status-dot--${node.alertLevel}`} aria-hidden="true" />
        )}
      </span>
      {showLabel && (
        <span className="spatial-node__label">
          <bdi>{node.displayName}</bdi>
          {node.usedPercent != null && (
            <span className="spatial-node__label-usage">{formatPercentage(node.usedPercent)}</span>
          )}
        </span>
      )}
    </button>
  );
}
