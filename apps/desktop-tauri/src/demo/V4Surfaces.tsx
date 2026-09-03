/**
 * V4 demo stage surfaces — Physical Surface architecture with synthetic
 * data. Notch (top), Slab (taskbar), Spine (edge) + HUD/Dashboard heroes.
 * Route: ?window=demo&surface=X&state=Y&gen=v4
 */
import { motion } from "motion/react";
import {
  QaPhysicalSurface,
  CHOREOGRAPHY,
  QaProviderIcon,
  QaValue,
  ArcGaugeV3,
} from "../design-system";

const DEMO = [
  { id: "claude", name: "Claude", remaining: 0.73, reset: "51m", pace: "1.2×" },
  { id: "codex", name: "Codex", remaining: 0.61, reset: "4d 4h", pace: "on track" },
  { id: "opencode", name: "OpenCode", remaining: 0.06, reset: "2h 10m", pace: "1.8×" },
];

function RingInstrument({ p, size, delay }: { p: (typeof DEMO)[number]; size: number; delay: number }) {
  const pct = Math.round(p.remaining * 100);
  return (
    <motion.div
      className="qa-wing"
      initial={{ opacity: 0, scale: 0.7, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ ...CHOREOGRAPHY.instrumentSpring, delay }}
      style={{ display: "flex", alignItems: "center", gap: 7 }}
    >
      <span style={{ position: "relative", display: "grid", placeItems: "center", width: size, height: size }}>
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <ArcGaugeV3 remaining={p.remaining} size={size} stroke={size >= 34 ? 3.4 : 3} ariaLabel={`${p.name} arc`} />
        </span>
        <span style={{ position: "relative", display: "grid", placeItems: "center" }}>
          <QaProviderIcon providerId={p.id} size={Math.round(size * 0.44)} />
        </span>
      </span>
      <QaValue size={size >= 34 ? "md" : "meta"}>{pct}</QaValue>
    </motion.div>
  );
}

function ResetLine({ p, delay }: { p: (typeof DEMO)[number]; delay: number }) {
  return (
    <motion.span
      className="qa-reset"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ ...CHOREOGRAPHY.contentEase, delay }}
      style={{ textAlign: "center", display: "block" }}
    >
      ↻ {p.reset}
    </motion.span>
  );
}

export function NotchSurfaceV4({ state }: { state: "idle" | "hover" | "expanded" }) {
  const expanded = state === "expanded";
  const w = expanded ? 520 : 320;
  const h = expanded ? 168 : 46;
  return (
    <QaPhysicalSurface anchor="top" width={w} height={h} anchorRadius={6} freeRadius={16} material={expanded ? "glass" : "graphite"}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", height: "100%", paddingTop: expanded ? 14 : 8 }}>
        {expanded ? (
          <div style={{ display: "flex", gap: 30, alignItems: "flex-start" }}>
            {DEMO.map((p, i) => (
              <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <RingInstrument p={p} size={44} delay={CHOREOGRAPHY.instrumentDelay(i)} />
                <ResetLine p={p} delay={CHOREOGRAPHY.contentDelay + i * 0.03} />
              </div>
            ))}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ ...CHOREOGRAPHY.contentEase, delay: CHOREOGRAPHY.contentDelay + 0.1 }}
              style={{ borderLeft: "1px solid var(--qa-hairline)", paddingLeft: 24, display: "flex", flexDirection: "column", gap: 4, paddingTop: 4 }}
            >
              <span className="qa-dash__callout-k">best capacity</span>
              <QaValue size="lg">73% · Claude</QaValue>
              <span className="qa-dash__callout-k" style={{ marginTop: 8 }}>needs attention</span>
              <QaValue><span style={{ color: "var(--qa-status-critical)" }}>6% · OpenCode</span></QaValue>
            </motion.div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 16 }}>
            {DEMO.map((p, i) => (
              <RingInstrument key={p.id} p={p} size={28} delay={CHOREOGRAPHY.instrumentDelay(i)} />
            ))}
          </div>
        )}
      </div>
    </QaPhysicalSurface>
  );
}

export function SlabSurfaceV4({ state }: { state: "idle" | "hover" | "expanded" }) {
  const expanded = state === "expanded";
  const w = expanded ? 620 : 300;
  const h = expanded ? 176 : 50;
  return (
    <QaPhysicalSurface anchor="bottom" width={w} height={h} anchorRadius={7} freeRadius={17} material={expanded ? "glass" : "graphite"}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", height: "100%", paddingTop: expanded ? 16 : 9 }}>
        {expanded ? (
          <div style={{ display: "flex", gap: 26 }}>
            {DEMO.map((p, i) => (
              <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <RingInstrument p={p} size={42} delay={CHOREOGRAPHY.instrumentDelay(i)} />
                <ResetLine p={p} delay={CHOREOGRAPHY.contentDelay + i * 0.03} />
              </div>
            ))}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ ...CHOREOGRAPHY.contentEase, delay: CHOREOGRAPHY.contentDelay + 0.1 }}
              style={{ borderLeft: "1px solid var(--qa-hairline)", paddingLeft: 22, display: "flex", flexDirection: "column", gap: 4, paddingTop: 2 }}
            >
              <span className="qa-dash__callout-k">best</span>
              <QaValue>73% · Claude</QaValue>
              <span className="qa-dash__callout-k" style={{ marginTop: 6 }}>burn</span>
              <QaValue size="meta">1.2× · on track</QaValue>
            </motion.div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 18 }}>
            {DEMO.map((p, i) => (
              <RingInstrument key={p.id} p={p} size={30} delay={CHOREOGRAPHY.instrumentDelay(i)} />
            ))}
          </div>
        )}
      </div>
    </QaPhysicalSurface>
  );
}

export function SpineSurfaceV4({ state }: { state: "idle" | "expanded" }) {
  const expanded = state === "expanded";
  const w = expanded ? 240 : 64;
  const h = 240;
  return (
    <QaPhysicalSurface anchor="right" width={w} height={h} anchorRadius={7} freeRadius={16} material={expanded ? "glass" : "graphite"}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", gap: 10, paddingLeft: 8, paddingRight: 10 }}>
        {DEMO.map((p, i) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <RingInstrument p={p} size={36} delay={CHOREOGRAPHY.instrumentDelay(i)} />
            {expanded && (
              <motion.div
                initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }}
                transition={{ ...CHOREOGRAPHY.contentEase, delay: CHOREOGRAPHY.contentDelay + i * 0.03 }}
                style={{ display: "flex", flexDirection: "column", gap: 1 }}
              >
                <span style={{ fontSize: "var(--qa-text-label)", fontWeight: 600 }}>{p.name}</span>
                <span className="qa-reset">↻ {p.reset}</span>
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </QaPhysicalSurface>
  );
}
