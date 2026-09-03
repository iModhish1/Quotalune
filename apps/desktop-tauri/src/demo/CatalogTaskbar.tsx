/**
 * QuotaArc V8 — production Taskbar composition (catalog themes).
 *
 * Occupancy rule: the main orbital instrument fills 65–85% of the frame.
 * Each theme's geometry drives an ornament layer (bezel, petals, crescent,
 * constellation map, cage, aperture blades, astrolabe, dunes...) rendered
 * as real SVG structure, plus layered material (base, inner surface, edge
 * highlight, selective accent glow). No containing rectangle: the housing
 * is the instrument.
 *
 * Demo route (Dev): ?window=demo&gen=v8&catalog=<slug>&state=idle|hover|expanded
 */
import { ArcGaugeV3 } from "../design-system/ArcGaugeV3";
import { QaProviderIcon, formatPercentage, arcFraction } from "../design-system";
import { catalogBySlug, providerColor, type CatalogTheme } from "../design-system/themeCatalog";

export type UsageMode = "used" | "remaining" | "hybrid";
export type ProviderStatus = "ok" | "attention" | "offline";

/**
 * Presentation-neutral provider contract for TaskbarStageV8.
 * The live surface resolves usage semantics (via applyUsageSemantics) and
 * passes the RENDER-READY values — the stage never computes modes itself.
 */
export interface StageProvider {
  /** Stable provider/account ID (not a display name). */
  id: string;
  name: string;
  /** Icon identifier for the normalized provider icon system. */
  iconId: string;
  /** Resolved arc fill: what the arc displays (0..=1 or null=unknown). */
  arcRemaining: number | null;
  /** Primary numeric value (per resolved mode), in percent. */
  value: number | null;
  /** Secondary value for HYBRID, in percent. */
  secondary: number | null;
  /** What the primary value means. */
  valueLabel: "used" | "remaining";
  reset: string;
  status: ProviderStatus;
  /** Optional non-identifying account label ("Work", "Main"). */
  accountLabel?: string | null;
}

const PROVIDERS: StageProvider[] = [
  { id: "openai", name: "OpenAI", iconId: "openai", arcRemaining: 0.68, value: 68, secondary: 32, valueLabel: "remaining", reset: "3h 40m", status: "ok" },
  { id: "claude", name: "Claude", iconId: "claude", arcRemaining: 0.62, value: 62, secondary: 38, valueLabel: "remaining", reset: "26h 18m", status: "ok" },
  { id: "gemini", name: "Gemini", iconId: "gemini", arcRemaining: 0.49, value: 49, secondary: 51, valueLabel: "remaining", reset: "22h 38m", status: "ok" },
  { id: "llama", name: "Llama", iconId: "llama", arcRemaining: 0.81, value: 81, secondary: 19, valueLabel: "remaining", reset: "5d 4h", status: "ok" },
  { id: "mistral", name: "Mistral", iconId: "mistral", arcRemaining: 0.57, value: 57, secondary: 43, valueLabel: "remaining", reset: "1d 2h", status: "ok" },
  { id: "deepseek", name: "DeepSeek", iconId: "deepseek", arcRemaining: 0.38, value: 38, secondary: 62, valueLabel: "remaining", reset: "19h 12m", status: "ok" },
  { id: "perplexity", name: "Perplexity", iconId: "perplexity", arcRemaining: 0.45, value: 45, secondary: 55, valueLabel: "remaining", reset: "3d 12h", status: "ok" },
];

/** Theme ornament: SVG structure behind/around the instruments. */
function ornament(theme: CatalogTheme, cx: number, cy: number, R: number): JSX.Element {
  const accent = theme.accent;
  const hl = "rgba(255,255,255,0.10)";
  switch (theme.geometry) {
    case "dial":
      return (
        <g>
          <circle cx={cx} cy={cy} r={R + 8} fill="none" stroke={accent} strokeOpacity={0.35} strokeWidth={2} />
          <circle cx={cx} cy={cy} r={R + 16} fill="none" stroke={hl} strokeWidth={1} />
          {Array.from({ length: 60 }, (_, i) => {
            const a = (i * 6 * Math.PI) / 180;
            const r1 = R + 4, r2 = R + (i % 5 === 0 ? 14 : 9);
            return <line key={i} x1={cx + r1 * Math.sin(a)} y1={cy - r1 * Math.cos(a)} x2={cx + r2 * Math.sin(a)} y2={cy - r2 * Math.cos(a)} stroke={accent} strokeOpacity={0.3} strokeWidth={1} />;
          })}
        </g>
      );
    case "eclipse":
      return (
        <g>
          <circle cx={cx} cy={cy} r={R + 6} fill="none" stroke="#f8fafc" strokeOpacity={0.5} strokeWidth={2.5} />
          <circle cx={cx} cy={cy} r={R + 14} fill="none" stroke={accent} strokeOpacity={0.18} strokeWidth={6} />
        </g>
      );
    case "nova":
      return (
        <g>
          <circle cx={cx} cy={cy} r={R + 18} fill="none" stroke={accent} strokeOpacity={0.4} strokeWidth={1.4} strokeDasharray="10 6" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            return <line key={i} x1={cx + (R - 6) * Math.sin(a)} y1={cy - (R - 6) * Math.cos(a)} x2={cx + (R + 16) * Math.sin(a)} y2={cy - (R + 16) * Math.cos(a)} stroke={accent} strokeOpacity={0.35} strokeWidth={1.2} />;
          })}
        </g>
      );
    case "aperture":
      return (
        <g>
          {Array.from({ length: 8 }, (_, i) => {
            const a1 = (i * 45 * Math.PI) / 180, a2 = a1 + 0.55;
            const p = `M ${cx + R * Math.sin(a1)} ${cy - R * Math.cos(a1)} A ${R} ${R} 0 0 1 ${cx + R * Math.sin(a2)} ${cy - R * Math.cos(a2)} L ${cx + (R + 12) * Math.sin(a2)} ${cy - (R + 12) * Math.cos(a2)} A ${R + 12} ${R + 12} 0 0 0 ${cx + (R + 12) * Math.sin(a1)} ${cy - (R + 12) * Math.cos(a1)} Z`;
            return <path key={i} d={p} fill="rgba(255,255,255,0.05)" stroke={hl} strokeWidth={0.8} />;
          })}
        </g>
      );
    case "astrolabe":
      return (
        <g>
          <circle cx={cx} cy={cy} r={R + 6} fill="none" stroke={hl} strokeWidth={1} />
          <circle cx={cx} cy={cy} r={R + 16} fill="none" stroke={accent} strokeOpacity={0.25} strokeWidth={1} strokeDasharray="3 5" />
          <ellipse cx={cx} cy={cy} rx={R + 12} ry={(R + 12) * 0.4} fill="none" stroke={hl} strokeWidth={0.9} />
          <line x1={cx - R - 16} y1={cy} x2={cx + R + 16} y2={cy} stroke={hl} strokeWidth={0.8} />
        </g>
      );
    case "constellation":
      return (
        <g>
          {Array.from({ length: 26 }, (_, i) => {
            const x = cx + ((i * 97) % 300) - 150;
            const y = cy + ((i * 61) % 200) - 100;
            return <circle key={i} cx={x} cy={y} r={i % 4 === 0 ? 1.4 : 0.8} fill="#d4b483" fillOpacity={0.7} />;
          })}
        </g>
      );
    case "petals":
      return (
        <g opacity={0.5}>
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i * 60 * Math.PI) / 180;
            const x = cx + R * 0.9 * Math.sin(a);
            const y = cy - R * 0.9 * Math.cos(a);
            return <ellipse key={i} cx={x} cy={y} rx={R * 0.42} ry={R * 0.2} transform={`rotate(${i * 60} ${x} ${y})`} fill="none" stroke="#67e8f9" strokeOpacity={0.4} strokeWidth={1.6} />;
          })}
        </g>
      );
    case "lens":
      return (
        <g>
          <circle cx={cx} cy={cy} r={R * 0.55} fill="none" stroke={accent} strokeOpacity={0.3} strokeWidth={1.4} />
          <circle cx={cx} cy={cy} r={R + 4} fill="none" stroke={accent} strokeOpacity={0.18} strokeWidth={1.2} />
        </g>
      );
    case "ice":
      return (
        <g opacity={0.6}>
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i * 60 + 30) * (Math.PI / 180);
            return <line key={i} x1={cx} y1={cy} x2={cx + (R + 10) * Math.sin(a)} y2={cy - (R + 10) * Math.cos(a)} stroke="#7dd3fc" strokeOpacity={0.45} strokeWidth={1.4} />;
          })}
        </g>
      );
    case "dunes":
      return (
        <g opacity={0.4}>
          <path d={`M ${cx - R - 20} ${cy + 30} Q ${cx} ${cy + 6} ${cx + R + 20} ${cy + 30}`} fill="none" stroke="#fbbf24" strokeOpacity={0.5} strokeWidth={1.6} />
          <path d={`M ${cx - R - 30} ${cy + 52} Q ${cx - 20} ${cy + 30} ${cx + R + 30} ${cy + 52}`} fill="none" stroke="#fbbf24" strokeOpacity={0.32} strokeWidth={1.2} />
        </g>
      );
    case "facets":
      return (
        <g opacity={0.5}>
          {Array.from({ length: 6 }, (_, i) => {
            const a1 = (i * 60 * Math.PI) / 180, a2 = ((i + 1) * 60 * Math.PI) / 180;
            const p = `M ${cx} ${cy} L ${cx + R * Math.sin(a1)} ${cy - R * Math.cos(a1)} L ${cx + R * Math.sin(a2)} ${cy - R * Math.cos(a2)} Z`;
            return <path key={i} d={p} fill="none" stroke="#a78bfa" strokeOpacity={0.4} strokeWidth={1.4} />;
          })}
        </g>
      );
    case "orchid":
      return (
        <g opacity={0.45}>
          {Array.from({ length: 5 }, (_, i) => {
            const a = (i * 72 * Math.PI) / 180;
            return <ellipse key={i} cx={cx + R * 0.75 * Math.sin(a)} cy={cy - R * 0.75 * Math.cos(a)} rx={R * 0.34} ry={R * 0.2} transform={`rotate(${i * 72} ${cx + R * 0.75 * Math.sin(a)} ${cy - R * 0.75 * Math.cos(a)})`} fill="none" stroke="#e879f9" strokeOpacity={0.5} strokeWidth={1.4} />;
          })}
        </g>
      );
    case "spine":
      return (
        <g>
          <line x1={cx} y1={cy - R - 14} x2={cx} y2={cy + R + 14} stroke={accent} strokeOpacity={0.3} strokeWidth={2} />
          {Array.from({ length: 5 }, (_, i) => (
            <circle key={i} cx={cx} cy={cy - R - 14 + (i * (R * 2 + 28)) / 4} r={2} fill={accent} fillOpacity={0.4} />
          ))}
        </g>
      );
    default: // orbit
      return <circle cx={cx} cy={cy} r={R + 5} fill="none" stroke={hl} strokeWidth={1} />;
  }
}

interface Props {
  catalog: string;
  state: "idle" | "hover" | "expanded";
  /** Live providers (production); synthetic seven used when omitted. */
  providers?: StageProvider[];
}

/** Production Taskbar composition: the orbital instrument IS the surface. */
export default function CatalogTaskbar({ catalog, state, providers }: Props) {
  const theme = catalogBySlug(catalog) ?? (catalogBySlug("01-obsidian-orbit") as CatalogTheme);
  const expanded = state === "expanded";
  const show = providers ?? (expanded ? PROVIDERS : PROVIDERS.slice(0, 3));
  const count = show.length;
  const isLight = theme.slug.startsWith("04");

  // Occupancy: instrument ring diameter fills the frame.
  const W = 820;
  const H = expanded ? 540 : 400;
  const R = expanded ? 168 : 118;
  const cx = W / 2;
  // Generous safe area below the arc for bottom instruments + labels + glow.
  const cy = expanded ? H - R - 120 : H / 2;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: `radial-gradient(ellipse 90% 70% at 50% 78%, ${theme.bg[0]}, ${theme.bg[1]})`,
        borderBottom: `1px solid ${isLight ? "rgba(12,18,27,0.10)" : "rgba(255,255,255,0.06)"}`,
        fontFamily: "var(--qa-font)",
        overflow: "hidden",
      }}
    >
      {/* theme ornament layer */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {ornament(theme, cx, cy, R + (expanded ? 18 : 8))}
      </svg>

      {/* provider orbital instruments */}
      {show.map((p, i) => {
        const a = expanded
          ? (-60 + i * 20) * (Math.PI / 180)
          : (-90 + i * 90) * (Math.PI / 180);
        const orbitR = R + (expanded ? 40 : 22);
        const x = cx + orbitR * Math.sin(a);
        const y = cy - orbitR * Math.cos(a);
        const size = expanded ? 66 : 58;
        const pct = p.value;
        const color = providerColor(theme, p.iconId);
        const focused = i === 1;
        return (
          <div key={p.id} style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, textAlign: "center" }}>
            <span style={{ position: "relative", display: "grid", placeItems: "center", width: size, height: size }}>
              <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                <ArcGaugeV3 remaining={p.arcRemaining} size={size} stroke={expanded ? 4.2 : 4} colorOverride={color} ariaLabel={`${p.name} ${p.valueLabel} arc`} />
              </span>
              <span
                style={{
                  position: "relative",
                  display: "grid",
                  placeItems: "center",
                  width: size * 0.62,
                  height: size * 0.62,
                  borderRadius: "50%",
                  background: "rgba(8,11,16,0.85)",
                  border: `1px solid ${color}55`,
                }}
              >
                <QaProviderIcon providerId={p.iconId} size={Math.round(size * 0.34)} />
              </span>
            </span>
            <span
              style={{
                display: "block",
                marginTop: 3,
                fontSize: expanded ? 14 : 13,
                fontWeight: 650,
                color: "var(--qa-ink-1)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatPercentage(p.value)}
            </span>
            {expanded && (
              <span className="qa-reset" style={{ display: "block", fontSize: 10.5 }}>
                ↻ {p.reset}
              </span>
            )}
          </div>
        );
      })}

      {/* core mark at the seam */}
      <div
        style={{
          position: "absolute",
          width: expanded ? 58 : 46,
          height: expanded ? 58 : 46,
          left: cx - (expanded ? 29 : 23),
          top: cy - (expanded ? 29 : 23),
          borderRadius: "50%",
          background: `radial-gradient(circle at 50% 28%, ${theme.coreEdge}, ${theme.core} 74%)`,
          border: `1px solid ${theme.accent}55`,
          boxShadow: `0 10px 26px rgba(0,0,0,0.6), 0 0 16px ${theme.accent}30, inset 0 1px 0 rgba(255,255,255,0.08)`,
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg width={expanded ? 22 : 18} height={expanded ? 22 : 18} viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="10" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="3.4" />
          <path d="M 9.9 22.1 A 10 10 0 1 1 22.1 22.1" fill="none" stroke={theme.accent} strokeWidth="3.4" strokeLinecap="round" />
        </svg>
      </div>

      {/* insight line under the core (expanded only) */}
      {false && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: cy + (expanded ? 96 : 36),
            textAlign: "center",
          }}
        >
          <span className="qa-reset" style={{ fontSize: 11.5 }}>
            best · Claude 62% · burn 1.2× · next reset 26h 18m
          </span>
        </div>
      )}
    </div>
  );
}
