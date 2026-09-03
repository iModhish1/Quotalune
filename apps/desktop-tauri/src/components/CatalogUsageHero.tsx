import type { CSSProperties } from "react";

import { ArcGaugeV3, QaProviderIcon, formatPercentage } from "../design-system";
import {
  catalogBySlug,
  providerColor,
  type CatalogTheme,
} from "../design-system/themeCatalog";
import OrbitTexture from "./orbit/OrbitTexture";
import type { StageProvider } from "./orbit/stageTypes";
import "./CatalogUsageHero.css";

interface CatalogUsageHeroProps {
  variant: "quick" | "dashboard";
  catalog: string;
  providers: StageProvider[];
  selectedProviderId?: string | null;
  onSelectProvider?: (providerId: string) => void;
  showProviderIcons?: boolean;
}

function complementaryValues(provider: StageProvider | undefined) {
  if (!provider || provider.primaryValue == null) {
    return { used: null, remaining: null };
  }
  if (provider.resolvedMode === "hybrid") {
    return {
      used: provider.primaryValue,
      remaining: provider.secondaryValue,
    };
  }
  return provider.primaryLabel === "used"
    ? { used: provider.primaryValue, remaining: 100 - provider.primaryValue }
    : { used: 100 - provider.primaryValue, remaining: provider.primaryValue };
}

export default function CatalogUsageHero({
  variant,
  catalog,
  providers,
  selectedProviderId,
  onSelectProvider,
  showProviderIcons = true,
}: CatalogUsageHeroProps) {
  const theme = catalogBySlug(catalog) ?? (catalogBySlug("01-obsidian-orbit") as CatalogTheme);
  const visible = providers.slice(0, 7);
  const focused = visible.find((provider) => provider.id === selectedProviderId) ?? visible[0];
  const color = focused ? providerColor(theme, focused.iconId) : theme.accent;
  const values = complementaryValues(focused);
  const light = theme.slug === "04-porcelain-halo";
  const style = {
    "--qa-hero-accent": theme.accent,
    "--qa-hero-core": theme.core,
    "--qa-hero-edge": theme.coreEdge,
  } as CSSProperties;

  if (variant === "quick") {
    return (
      <section
        className="qa-catalog-hero qa-catalog-hero--quick"
        data-theme={theme.slug}
        data-light={light}
        style={style}
        aria-label={`${theme.name} usage focus`}
      >
        <div className="qa-catalog-hero__focus-ring">
          <ArcGaugeV3
            className="qa-catalog-hero__focus-gauge"
            remaining={focused?.arcFraction ?? null}
            size={112}
            stroke={6}
            colorOverride={color}
            ariaLabel={`${focused?.name ?? "Provider"} usage arc`}
          />
          <div className="qa-catalog-hero__focus-core">
            <div>
              <span className="qa-catalog-hero__focus-name">{focused?.name ?? "QuotaArc"}</span>
              <strong className="qa-catalog-hero__focus-value">{formatPercentage(focused?.primaryValue)}</strong>
              <span className="qa-catalog-hero__focus-mode">{focused?.primaryLabel ?? "unavailable"}</span>
            </div>
          </div>
        </div>
        <div className="qa-catalog-hero__quick-detail">
          <div className="qa-catalog-hero__quick-title">
            {focused && showProviderIcons && <QaProviderIcon providerId={focused.iconId} size={18} />}
            <span>{focused?.name ?? "No provider data"}</span>
          </div>
          <div className="qa-catalog-hero__stats">
            <div className="qa-catalog-hero__stat">
              <span>Used</span>
              <strong>{formatPercentage(values.used)}</strong>
            </div>
            <div className="qa-catalog-hero__stat">
              <span>Remaining</span>
              <strong>{formatPercentage(values.remaining)}</strong>
            </div>
          </div>
          <div className="qa-catalog-hero__reset">↻ Resets {focused?.reset ?? "—"}</div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="qa-catalog-hero qa-catalog-hero--dashboard"
      data-theme={theme.slug}
      data-light={light}
      style={style}
      aria-label={`${theme.name} dashboard orbit`}
    >
      <svg className="qa-catalog-hero__orbit-svg" viewBox="0 0 640 330" aria-hidden="true">
        <OrbitTexture theme={theme} cx={320} cy={165} radiusX={260} radiusY={138} />
        {[78, 112, 142].map((radiusY, index) => (
          <ellipse
            key={radiusY}
            cx={320}
            cy={165}
            rx={radiusY * 1.82}
            ry={radiusY}
            fill="none"
            stroke={index === 1 ? theme.accent : theme.hairline}
            strokeOpacity={index === 1 ? 0.18 : 0.7}
            strokeWidth={index === 1 ? 1.2 : 0.8}
          />
        ))}
        {visible.map((_, index) => {
          const angle = -90 + (360 * index) / Math.max(1, visible.length);
          const radians = (angle * Math.PI) / 180;
          return (
            <line
              key={index}
              x1={320}
              y1={165}
              x2={320 + 230 * Math.sin(radians)}
              y2={165 - 109 * Math.cos(radians)}
              stroke={theme.hairline}
              strokeWidth={0.8}
            />
          );
        })}
      </svg>

      {visible.map((provider, index) => {
        const angle = -90 + (360 * index) / Math.max(1, visible.length);
        const radians = (angle * Math.PI) / 180;
        const nodeColor = providerColor(theme, provider.iconId);
        return (
          <button
            key={provider.id}
            type="button"
            className="qa-catalog-hero__orbit-node"
            data-selected={provider.id === focused?.id}
            style={{
              left: `${50 + 36 * Math.sin(radians)}%`,
              top: `${50 - 33 * Math.cos(radians)}%`,
              "--qa-hero-node": nodeColor,
            } as CSSProperties}
            onClick={() => onSelectProvider?.(provider.id)}
            aria-pressed={provider.id === focused?.id}
            aria-label={`${provider.name}: ${formatPercentage(provider.primaryValue)} ${provider.primaryLabel}`}
          >
            <span className="qa-catalog-hero__orbit-node-ring">
              <ArcGaugeV3
                className="qa-catalog-hero__node-gauge"
                remaining={provider.arcFraction}
                size={50}
                stroke={3.5}
                colorOverride={nodeColor}
                ariaLabel={`${provider.name} usage arc`}
              />
              {showProviderIcons && (
                <span className="qa-catalog-hero__node-icon">
                  <QaProviderIcon providerId={provider.iconId} size={16} />
                </span>
              )}
            </span>
            <span className="qa-catalog-hero__node-label">{formatPercentage(provider.primaryValue)}</span>
          </button>
        );
      })}

      <div className="qa-catalog-hero__dashboard-core">
        <div>
          <span className="qa-catalog-hero__focus-name">{focused?.name ?? "QuotaArc"}</span>
          <strong className="qa-catalog-hero__focus-value">{formatPercentage(focused?.primaryValue)}</strong>
          <span className="qa-catalog-hero__focus-mode">{focused?.primaryLabel ?? "unavailable"}</span>
          <span className="qa-catalog-hero__reset">↻ {focused?.reset ?? "—"}</span>
        </div>
      </div>
    </section>
  );
}
