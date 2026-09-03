/**
 * QuotaArc V6.5 — catalog theme surfaces.
 *
 * Renders the radial composition (Arc V3 instruments on true orbits) themed
 * by a catalog entry: theme-specific background, core/housing material,
 * provider energy palette, connector tone, and geometry accent. The seven
 * canonical providers orbit; focus grows the focused instrument.
 *
 * Demo route: ?window=demo&gen=catalog&catalog=<slug>&surface=taskbar|top|edge|hud
 */
import { ArcGaugeV3, QaProviderIcon } from "../design-system";
import { computeOrbit, type OrbitMode, type Polar } from "../design-system/RadialLayout";
import { catalogBySlug, providerColor, type CatalogTheme } from "../design-system/themeCatalog";

const PROVIDERS = [
  { id: "openai", name: "OpenAI", remaining: 0.68, reset: "3h 40m" },
  { id: "claude", name: "Claude", remaining: 0.62, reset: "26h 18m" },
  { id: "gemini", name: "Gemini", remaining: 0.49, reset: "22h 38m" },
  { id: "llama", name: "Llama", remaining: 0.81, reset: "5d 4h" },
  { id: "mistral", name: "Mistral", remaining: 0.57, reset: "1d 2h" },
  { id: "deepseek", name: "DeepSeek", remaining: 0.38, reset: "19h 12m" },
  { id: "perplexity", name: "Perplexity", remaining: 0.45, reset: "3d 12h" },
];

const MODE_BY_SURFACE: Record<string, OrbitMode> = {
  taskbar: "SEMICIRCLE_UP",
  top: "SEMICIRCLE_DOWN",
  edge: "LEFT_HALF_ORBIT",
  hud: "FULL_ORBIT",
};

function Orb({
  theme,
  p,
  size,
  x,
  y,
  focus,
  reset,
}: {
  theme: CatalogTheme;
  p: (typeof PROVIDERS)[number];
  size: number;
  x: number;
  y: number;
  focus: boolean;
  reset?: string | null;
}) {
  const pct = Math.round(p.remaining * 100);
  const color = providerColor(theme, p.id);
  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
      }}
    >
      <span
        style={{
          position: "relative",
          display: "grid",
          placeItems: "center",
          width: focus ? size + 6 : size,
          height: focus ? size + 6 : size,
          filter: focus ? `drop-shadow(0 0 8px ${color}55)` : "none",
          transition: "filter 200ms",
        }}
      >
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <ArcGaugeV3
            remaining={p.remaining}
            size={focus ? size + 6 : size}
            stroke={size >= 40 ? 3.4 : 3}
            colorOverride={providerColor(theme, p.id)}
            ariaLabel={`${p.name} arc`}
            className="qa-catalog-arc"
          />
        </span>
        <span style={{ position: "relative", display: "grid", placeItems: "center" }}>
          <QaProviderIcon providerId={p.id} size={Math.round(size * 0.4)} />
        </span>
      </span>
      <span
        style={{
          fontSize: size >= 40 ? 12 : 11,
          fontWeight: 600,
          color: "var(--qa-ink-1)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {pct}%
      </span>
      {reset && <span className="qa-reset">↻ {reset}</span>}
    </div>
  );
}

export default function CatalogSurface({
  catalog,
  surface,
  state,
}: {
  catalog: string;
  surface: string;
  state: "idle" | "hover" | "expanded";
}) {
  const theme = catalogBySlug(catalog) ?? (catalogBySlug("01-obsidian-orbit") as CatalogTheme);
  const expanded = state === "expanded";
  const focusedIdx = 1; // Claude focus for the study captures
  const count = expanded ? PROVIDERS.length : 3;
  const providers = PROVIDERS.slice(0, count);
  const radius = expanded ? 132 : 92;
  const size = expanded ? 48 : 38;
  const mode: OrbitMode = MODE_BY_SURFACE[surface] ?? "SEMICIRCLE_UP";

  const stageW = surface === "hud" ? 420 : surface === "edge" ? 240 : 460;
  const stageH = surface === "hud" ? 420 : surface === "edge" ? 300 : 300;
  const center = { x: stageW / 2, y: stageH / 2 };
  if (surface === "taskbar") center.y = stageH - 40;
  if (surface === "top") center.y = 34;
  if (surface === "edge") center.x = stageW; // core half off-screen

  const positions: Polar[] = computeOrbit({
    centerX: center.x,
    centerY: center.y,
    radius,
    mode,
    count: providers.length,
  });

  const coreSize = surface === "hud" ? 72 : 52;
  const isLight = theme.slug.startsWith("04");

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: `radial-gradient(ellipse at ${surface === "edge" ? "85%" : "50%"} 40%, ${theme.bg[0]}, ${theme.bg[1]})`,
        borderRadius: surface === "taskbar" ? "20px 20px 0 0" : surface === "top" ? "0 0 22px 22px" : 20,
        overflow: "hidden",
        fontFamily: "var(--qa-font)",
      }}
    >
      {/* orbit guide ring (theme hairline) */}
      <svg width={stageW} height={stageH} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <circle
          cx={center.x}
          cy={center.y}
          r={radius}
          fill="none"
          stroke={theme.hairline}
          strokeWidth={1}
          strokeDasharray={theme.geometry === "constellation" ? "2 6" : undefined}
        />
        {positions.map((pos, i) => (
          <line
            key={i}
            x1={center.x}
            y1={center.y}
            x2={pos.x}
            y2={pos.y}
            stroke={theme.hairline}
            strokeWidth={theme.geometry === "constellation" ? 0.6 : 1}
          />
        ))}
      </svg>

      {providers.map((p, i) => {
        const pos = positions[i];
        return (
          <Orb
            key={p.id}
            theme={theme}
            p={p}
            size={size}
            x={pos.x}
            y={pos.y}
            focus={i === focusedIdx}
            reset={expanded ? p.reset : null}
          />
        );
      })}

      {/* core */}
      <div
        style={{
          position: "absolute",
          width: coreSize,
          height: coreSize,
          left: center.x - coreSize / 2,
          top: center.y - coreSize / 2,
          borderRadius: "50%",
          background: `radial-gradient(circle at 50% 30%, ${theme.coreEdge}, ${theme.core} 72%)`,
          border: `1px solid ${theme.accent}44`,
          boxShadow: `0 12px 34px rgba(0,0,0,0.55), 0 0 18px ${theme.accent}22, inset 0 1px 0 rgba(255,255,255,0.07)`,
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg width={coreSize * 0.38} height={coreSize * 0.38} viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="10" fill="none" stroke={isLight ? "rgba(12,18,27,0.18)" : "rgba(255,255,255,0.16)"} strokeWidth="3.2" />
          <path
            d="M 9.9 22.1 A 10 10 0 1 1 22.1 22.1"
            fill="none"
            stroke={theme.accent}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* compact state hides labels; expanded reveals them (handled in Orb via reset) */}
      {isLight && (
        <div
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        />
      )}
    </div>
  );
}
