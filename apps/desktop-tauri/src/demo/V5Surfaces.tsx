/**
 * QuotaArc V5 — Radial Luxury surfaces (demo stage, synthetic data).
 *
 * Providers sit on TRUE orbits around a core (QaRadialCore), computed by
 * RadialLayout. Housing exists only where needed (core disc + optional
 * connectors) — never a containing rectangle. Compact materials are opaque.
 */
import { ArcGaugeV3, QaProviderIcon, applyUsageSemantics, resolveUsageMode, type UsageDisplayConfig } from "../design-system";
import { computeOrbit, V5_MATERIAL, type OrbitMode } from "../design-system/RadialLayout";

const PROVIDERS = [
  { id: "claude", name: "Claude", remaining: 0.73, reset: "51m", pace: "1.2×" },
  { id: "codex", name: "Codex", remaining: 0.61, reset: "4d 4h", pace: "on track" },
  { id: "opencode", name: "OpenCode", remaining: 0.06, reset: "2h 10m", pace: "1.8×" },
];

/** QaOrbitalProvider — glyph inside the capacity arc; value beside/below. */
function Orbital({
  p,
  size,
  x,
  y,
  delay,
  valueBelow,
  showReset,
  focused = false,
  usageConfig,
}: {
  p: (typeof PROVIDERS)[number];
  size: number;
  x: number;
  y: number;
  delay: number;
  valueBelow?: boolean;
  showReset?: boolean;
  focused?: boolean;
  usageConfig?: UsageDisplayConfig;
}) {
  const mode = usageConfig
    ? resolveUsageMode(usageConfig, p.id)
    : "remaining";
  const s = applyUsageSemantics(mode, p.remaining);
  const pct = s.value == null ? null : Math.round(s.value);
  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        display: "flex",
        flexDirection: valueBelow ? "column" : "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span style={{ position: "relative", display: "grid", placeItems: "center", width: size, height: size }}>
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <ArcGaugeV3
            remaining={s.arc}
            size={focused ? size + 4 : size}
            stroke={size >= 44 ? 4 : 3.2}
            ariaLabel={`${p.name} ${s.label} arc`}
          />
        </span>
        <span style={{ position: "relative", display: "grid", placeItems: "center" }}>
          <QaProviderIcon providerId={p.id} size={Math.round(size * 0.42)} />
        </span>
      </span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
        <span className="qa-value" style={{ fontSize: size >= 44 ? 14 : 12 }}>{pct}</span>
        {showReset && (
          <span className="qa-reset">↻ {p.reset} · {s.label}</span>
        )}
      </span>
    </div>
  );
}

/** QaRadialCore — the physical reason the orbit exists. */
function Core({ size, label }: { size: number; label?: string }) {
  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        borderRadius: "50%",
        background: `radial-gradient(circle at 50% 32%, ${V5_MATERIAL.coreEdge}, ${V5_MATERIAL.core} 70%)`,
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
        display: "grid",
        placeItems: "center",
      }}
    >
      {label ? (
        <span className="qa-value" style={{ fontSize: size >= 44 ? 12 : 10, color: "var(--qa-ink-2)" }}>{label}</span>
      ) : (
        <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="10" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="3.2" />
          <path d="M 9.9 22.1 A 10 10 0 1 1 22.1 22.1" fill="none" stroke="var(--qa-accent)" strokeWidth="3.2" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

export interface V5StageProps {
  state: "idle" | "hover" | "expanded";
  providers?: typeof PROVIDERS;
  /** Active provider index (clock/orbit selection). */
  focus?: number;
  usageConfig?: UsageDisplayConfig;
}

/** Taskbar V5 — core disc on the taskbar seam; providers FAN above. */
export function TaskbarRadialV5({ state, focus = -1, usageConfig }: V5StageProps) {
  const expanded = state === "expanded";
  const radius = expanded ? 128 : 86;
  const positions = computeOrbit({ centerX: 170, centerY: 190, radius, mode: "SEMICIRCLE_UP", count: PROVIDERS.length });
  return (
    <div style={{ position: "relative", width: 340, height: 210 }}>
      {positions.map((pos, i) => (
        <Orbital
          key={PROVIDERS[i].id}
          p={PROVIDERS[i]}
          size={expanded ? 44 : 36}
          x={pos.x}
          y={pos.y}
          delay={0.08 + i * 0.06}
          showReset={expanded}
          focused={focus === i}
          usageConfig={usageConfig}
        />
      ))}
      {/* connector hairlines (restrained) */}
      {positions.map((pos, i) => (
        <svg
          key={`c${i}`}
          width={340}
          height={210}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          <line
            x1={170}
            y1={190}
            x2={pos.x}
            y2={pos.y}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />
        </svg>
      ))}
      <Core size={46} label={expanded ? "73%" : undefined} />
      {expanded && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 196, textAlign: "center" }}>
          <span className="qa-reset">best · Claude 73% · burn 1.2×</span>
        </div>
      )}
    </div>
  );
}

/** Top V5 — inverted radial fan growing DOWN from the top edge. */
export function TopRadialV5({ state, focus = -1, usageConfig }: V5StageProps) {
  const expanded = state === "expanded";
  const radius = expanded ? 120 : 80;
  const positions = computeOrbit({ centerX: 190, centerY: 24, radius, mode: "SEMICIRCLE_DOWN", count: PROVIDERS.length });
  return (
    <div style={{ position: "relative", width: 380, height: 210 }}>
      {positions.map((pos, i) => (
        <Orbital
          key={PROVIDERS[i].id}
          p={PROVIDERS[i]}
          size={expanded ? 44 : 36}
          x={pos.x}
          y={pos.y}
          delay={0.08 + i * 0.06}
          valueBelow
          showReset={expanded}
          focused={focus === i}
          usageConfig={usageConfig}
        />
      ))}
      <Core size={44} />
    </div>
  );
}

/** Edge V5 (right) — core half-on the edge; providers on the LEFT half orbit. */
export function EdgeRadialV5({ state, focus = -1, usageConfig }: V5StageProps) {
  const expanded = state === "expanded";
  const radius = expanded ? 130 : 96;
  const positions = computeOrbit({ centerX: 240, centerY: 130, radius, mode: "LEFT_HALF_ORBIT", count: PROVIDERS.length });
  return (
    <div style={{ position: "relative", width: 240, height: 260 }}>
      {positions.map((pos, i) => (
        <Orbital
          key={PROVIDERS[i].id}
          p={PROVIDERS[i]}
          size={expanded ? 44 : 36}
          x={pos.x}
          y={pos.y}
          delay={0.08 + i * 0.06}
          valueBelow
          showReset={expanded}
          focused={focus === i}
          usageConfig={usageConfig}
        />
      ))}
      {/* CORE: physically half beyond the right screen edge */}
      <div
        style={{
          position: "absolute",
          width: 48,
          height: 48,
          right: -24,
          top: "50%",
          transform: "translateY(-50%)",
          borderRadius: "50%",
          background: `radial-gradient(circle at 40% 32%, ${V5_MATERIAL.coreEdge}, ${V5_MATERIAL.core} 72%)`,
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg width={18} height={18} viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="10" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="3.2" />
          <path d="M 9.9 22.1 A 10 10 0 1 1 22.1 22.1" fill="none" stroke="var(--qa-accent)" strokeWidth="3.2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

/** HUD V5 — full 360° orbit (purest radial identity). */
export function HudRadialV5({ state, focus = -1, usageConfig }: V5StageProps) {
  const expanded = state === "expanded";
  const radius = expanded ? 150 : 110;
  const positions = computeOrbit({ centerX: 190, centerY: 190, radius, mode: "FULL_ORBIT", count: PROVIDERS.length });
  return (
    <div style={{ position: "relative", width: 380, height: 380 }}>
      <svg width={380} height={380} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <circle cx={190} cy={190} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
      </svg>
      {positions.map((pos, i) => (
        <Orbital
          key={PROVIDERS[i].id}
          p={PROVIDERS[i]}
          size={expanded ? 48 : 40}
          x={pos.x}
          y={pos.y}
          delay={0.08 + i * 0.07}
          valueBelow
          showReset={expanded}
        />
      ))}
      <Core size={expanded ? 72 : 60} label={expanded ? "67%" : undefined} />
    </div>
  );
}
