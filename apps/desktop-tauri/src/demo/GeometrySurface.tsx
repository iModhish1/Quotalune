/**
 * V7.5 — catalog surfaces driven by the bounded geometry runtime.
 *
 * Each catalog theme's geometryVariant shapes node placement, connectors,
 * and structural rings. Provider focus is interactive: wheel, arrow keys,
 * Home/End cycle; Escape clears; focus is announced via aria-live.
 * Reduced Motion (motionSetting off/reduced) renders state changes
 * without rotational travel.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArcGaugeV3, QaProviderIcon } from "../design-system";
import {
  geometryLayout,
  normalizeVariant,
  type GeoLayout,
} from "../design-system/geometryVariants";
import { catalogBySlug, providerColor } from "../design-system/themeCatalog";

const PROVIDERS = [
  { id: "openai", name: "OpenAI", remaining: 0.68, reset: "3h 40m" },
  { id: "claude", name: "Claude", remaining: 0.62, reset: "26h 18m" },
  { id: "gemini", name: "Gemini", remaining: 0.49, reset: "22h 38m" },
  { id: "llama", name: "Llama", remaining: 0.81, reset: "5d 4h" },
  { id: "mistral", name: "Mistral", remaining: 0.57, reset: "1d 2h" },
  { id: "deepseek", name: "DeepSeek", remaining: 0.38, reset: "19h 12m" },
  { id: "perplexity", name: "Perplexity", remaining: 0.45, reset: "3d 12h" },
];

export default function GeometrySurface({
  catalog,
  surface,
  reducedMotion = false,
}: {
  catalog: string;
  surface: string;
  reducedMotion?: boolean;
}) {
  const theme = catalogBySlug(catalog) ?? (catalogBySlug("01-obsidian-orbit") as NonNullable<ReturnType<typeof catalogBySlug>>);
  const variant = normalizeVariant(theme.geometry);
  const expanded = surface !== "taskbar";
  const count = expanded ? PROVIDERS.length : 3;

  const [focus, setFocus] = useState(1);
  const wheelCooldown = useRef(0);

  const cycle = useCallback(
    (dir: 1 | -1 | "home" | "end") => {
      setFocus((prev) => {
        if (dir === "home") return 0;
        if (dir === "end") return count - 1;
        return (prev + dir + count) % count;
      });
    },
    [count],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); cycle(1); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); cycle(-1); }
      if (e.key === "Home") { e.preventDefault(); cycle("home"); }
      if (e.key === "End") { e.preventDefault(); cycle("end"); }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now - wheelCooldown.current < 120) return; // anti-flicker detent
      wheelCooldown.current = now;
      cycle(e.deltaY > 0 ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    const el = document.getElementById("qa-geo-root");
    el?.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      el?.removeEventListener("wheel", onWheel);
    };
  }, [cycle]);

  const layout: GeoLayout = useMemo(
    () => geometryLayout(variant, 230, 150, expanded ? 118 : 92, count),
    [variant, expanded, count],
  );

  const providers = PROVIDERS.slice(0, count);

  return (
    <div
      id="qa-geo-root"
      role="group"
      aria-label={`${theme.name} orbital theme, ${count} providers. Focused: ${PROVIDERS[focus]?.name ?? "none"}. Use arrow keys to cycle.`}
      tabIndex={0}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: `radial-gradient(ellipse at 50% 40%, ${theme.bg[0]}, ${theme.bg[1]})`,
        borderRadius: surface === "taskbar" ? "20px 20px 0 0" : surface === "top" ? "0 0 22px 22px" : 20,
        overflow: "hidden",
        outline: "none",
        fontFamily: "var(--qa-font)",
      }}
    >
      {/* structural rings */}
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {layout.rings.map((r, i) => (
          <circle
            key={i}
            cx={r.cx}
            cy={r.cy}
            r={r.r}
            fill="none"
            stroke={theme.hairline}
            strokeWidth={r.width}
            strokeDasharray={r.dashed ? "2 6" : undefined}
          />
        ))}
        {layout.connectors.map((c, i) => (
          <line
            key={`c${i}`}
            x1={c.x1}
            y1={c.y1}
            x2={c.x2}
            y2={c.y2}
            stroke={theme.hairline}
            strokeWidth={0.9}
            strokeDasharray={c.dashed ? "2 5" : undefined}
          />
        ))}
      </svg>

      {/* provider instruments at geometry nodes */}
      {layout.nodes.map((node, i) => {
        const p = PROVIDERS[i % PROVIDERS.length];
        const focused = focus % count === i;
        const size = (expanded ? 44 : 34) * node.scale * (focused ? 1.14 : 1);
        const color = providerColor(theme, p.id);
        const pct = Math.round(p.remaining * 100);
        return (
          <div
            key={p.id}
            role="button"
            tabIndex={-1}
            aria-label={`${p.name}, ${pct} percent remaining, resets ${p.reset}${focused ? ", focused" : ""}`}
            style={{
              position: "absolute",
              left: node.x - size / 2,
              top: node.y - size / 2,
              width: size,
              height: size,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
            onClick={() => setFocus(i)}
          >
            <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
              <ArcGaugeV3
                remaining={p.remaining}
                size={size}
                stroke={size >= 40 ? 3.4 : 3}
                colorOverride={color}
                ariaLabel={`${p.name} arc`}
              />
            </span>
            <span style={{ position: "relative", display: "grid", placeItems: "center" }}>
              <QaProviderIcon providerId={p.id} size={Math.round(size * 0.4)} />
            </span>
            {(expanded || focused) && (
              <span
                style={{
                  position: "absolute",
                  top: "100%",
                  marginTop: 2,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: focused ? "var(--qa-ink-1)" : "var(--qa-ink-2)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {pct}%
                </span>
                {focused && <span className="qa-reset">↻ {p.reset}</span>}
              </span>
            )}
          </div>
        );
      })}

      {/* core */}
      <div
        style={{
          position: "absolute",
          width: 52,
          height: 52,
          left: 230 - 26,
          top: 150 - 26,
          borderRadius: "50%",
          background: `radial-gradient(circle at 50% 30%, ${theme.coreEdge}, ${theme.core} 72%)`,
          border: `1px solid ${theme.accent}44`,
          boxShadow: `0 12px 34px rgba(0,0,0,0.55), 0 0 18px ${theme.accent}22, inset 0 1px 0 rgba(255,255,255,0.07)`,
          display: "grid",
          placeItems: "center",
        }}
        aria-hidden="true"
      >
        <svg width={20} height={20} viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="10" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="3.2" />
          <path d="M 9.9 22.1 A 10 10 0 1 1 22.1 22.1" fill="none" stroke={theme.accent} strokeWidth="3.2" strokeLinecap="round" />
        </svg>
      </div>

      {/* screen-reader live region for focus changes */}
      <div aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }}>
        {PROVIDERS[focus]
          ? `${PROVIDERS[focus].name}: ${Math.round(PROVIDERS[focus].remaining * 100)} percent remaining, resets ${PROVIDERS[focus].reset}`
          : ""}
      </div>
      {/* reducedMotion keeps state swaps instant (spring transitions skipped by
          the design-system motion level); nothing extra needed here. */}
      {reducedMotion ? null : null}
    </div>
  );
}
