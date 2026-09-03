/**
 * QuotaArc V7.5 — bounded geometry runtime.
 *
 * Each catalog theme's geometryVariant controls real structure: node
 * placement math, connector paths, and core silhouette parameters.
 * Shared contracts (accessibility, ordering, data semantics) stay in the
 * surface layer; only geometry lives here.
 *
 * All functions are pure and deterministic: same inputs → same layout,
 * so provider positions are stable across refreshes.
 */

export type GeometryVariant =
  | "orbit"
  | "petals"
  | "dial"
  | "constellation"
  | "spine"
  | "eclipse"
  | "facets"
  | "orchid"
  | "ice"
  | "lens"
  | "nova"
  | "aperture"
  | "astrolabe"
  | "dunes";

export interface GeoNode {
  x: number;
  y: number;
  /** Per-node radius scale (1 = nominal ring size). */
  scale: number;
}

export interface GeoLayout {
  nodes: GeoNode[];
  /** Connector path segments (core → node or node → node). */
  connectors: Array<{ x1: number; y1: number; x2: number; y2: number; dashed: boolean }>;
  /** Extra structural rings (orbit guides, bezels, cages). */
  rings: Array<{ cx: number; cy: number; r: number; dashed: boolean; width: number }>;
  /** Core silhouette: outer shape radius and squash (ellipse factor). */
  core: { radius: number; squash: number };
}

interface GeoSpec {
  cx: number;
  cy: number;
  radius: number;
  count: number;
  /** Deterministic pseudo-random from index — stable across refreshes. */
}

function jitter(i: number, amp: number): number {
  // Deterministic: golden-ratio in [0,1)
  const t = ((i * 0.618033988749895) % 1) * 2 - 1;
  return t * amp;
}

/**
 * Geometry-specific node placement + structure. Angles: 0° = up,
 * clockwise (same convention as RadialLayout).
 */
export function geometryLayout(
  variant: GeometryVariant,
  cx: number,
  cy: number,
  radius: number,
  count: number,
): GeoLayout {
  const nodes: GeoNode[] = [];
  const connectors: GeoLayout["connectors"] = [];
  const rings: GeoLayout["rings"] = [];
  let core = { radius: 26, squash: 1 };

  const ringPos = (angleDeg: number, r: number, scale = 1): GeoNode => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad), scale };
  };

  switch (variant) {
    case "orbit": {
      // Standard even ring + hairline spokes (Obsidian Orbit baseline).
      for (let i = 0; i < count; i++) {
        nodes.push(ringPos((360 / count) * i, radius));
        connectors.push({ x1: cx, y1: cy, x2: nodes[i].x, y2: nodes[i].y, dashed: false });
      }
      rings.push({ cx, cy, r: radius, dashed: false, width: 1 });
      break;
    }
    case "petals": {
      // Petal fan: alternating radii + slight angular interleave (Aurora).
      for (let i = 0; i < count; i++) {
        const angle = -70 + (i * 140) / Math.max(1, count - 1) + jitter(i, 8);
        const r = radius * (i % 2 === 0 ? 1 : 0.78);
        nodes.push(ringPos(angle, r, i % 2 === 0 ? 1 : 0.88));
        connectors.push({ x1: cx, y1: cy, x2: nodes[i].x, y2: nodes[i].y, dashed: true });
      }
      rings.push({ cx, cy, r: radius * 0.62, dashed: true, width: 0.8 });
      break;
    }
    case "dial": {
      // Precision dial: bezel ring + tick marks + perfectly even nodes (Solar Ember).
      for (let i = 0; i < count; i++) nodes.push(ringPos((360 / count) * i, radius));
      rings.push({ cx, cy, r: radius + 14, dashed: false, width: 1.5 });
      rings.push({ cx, cy, r: radius - 16, dashed: false, width: 0.7 });
      break;
    }
    case "constellation": {
      // Constellation: irregular star positions joined by hairline paths (Noir).
      for (let i = 0; i < count; i++) {
        const angle = (360 / count) * i + jitter(i, 26);
        const r = radius * (0.82 + ((Math.abs(jitter(i, 1)) + 1) % 1) * 0.3);
        nodes.push(ringPos(angle, r, 0.92));
        if (i > 0) {
          connectors.push({
            x1: nodes[i - 1].x, y1: nodes[i - 1].y,
            x2: nodes[i].x, y2: nodes[i].y, dashed: false,
          });
        }
      }
      break;
    }
    case "spine": {
      // Articulated spine: two offset columns along a central rail (Halo Spine).
      for (let i = 0; i < count; i++) {
        const y = cy - radius + (i * (radius * 2)) / Math.max(1, count - 1);
        const side = i % 2 === 0 ? -1 : 1;
        nodes.push({ x: cx + side * radius * 0.34, y, scale: 1 });
        connectors.push({ x1: cx, y1: cy, x2: nodes[i].x, y2: y, dashed: false });
      }
      break;
    }
    case "eclipse": {
      // Eclipse: nodes cluster along the crescent's lit rim (Eclipse Dial).
      for (let i = 0; i < count; i++) {
        const angle = -50 + (i * 100) / Math.max(1, count - 1);
        nodes.push(ringPos(angle, radius, 1));
      }
      rings.push({ cx: cx + radius * 0.22, cy, r: radius, dashed: false, width: 1.2 });
      break;
    }
    case "facets": {
      // Crystal facets: polygonal placement on a faceted ring (Prism Zenith).
      const sides = Math.max(5, count);
      for (let i = 0; i < count; i++) {
        const angle = (360 / sides) * i + 15;
        nodes.push(ringPos(angle, radius * (i % 2 === 0 ? 1 : 0.9), 0.95));
        const next = ringPos(angle + 360 / sides, radius);
        const cur = nodes[nodes.length - 1];
        connectors.push({ x1: cur.x, y1: cur.y, x2: next.x, y2: next.y, dashed: false });
      }
      break;
    }
    case "orchid": {
      // Orchid: spiral petal placement with stamen core (Quantum Orchid).
      for (let i = 0; i < count; i++) {
        const angle = (360 / count) * i + i * 14;
        const r = radius * (0.7 + (i / Math.max(1, count - 1)) * 0.34);
        nodes.push(ringPos(angle, r, 0.9 + (i % 2) * 0.12));
      }
      break;
    }
    case "ice": {
      // Ice: crystalline arcs with frosted offsets (Celestial Ice).
      for (let i = 0; i < count; i++) {
        const angle = -90 + (i * 180) / Math.max(1, count - 1);
        nodes.push(ringPos(angle, radius, 1));
        connectors.push({ x1: cx, y1: cy - radius, x2: nodes[i].x, y2: nodes[i].y, dashed: true });
      }
      rings.push({ cx, cy, r: radius * 0.55, dashed: true, width: 0.8 });
      break;
    }
    case "lens": {
      // Gravitational lens: nodes compressed toward the core plane (Emerald).
      for (let i = 0; i < count; i++) {
        const angle = 180 - (i * 180) / Math.max(1, count - 1);
        const compress = 0.62 + 0.38 * Math.abs(Math.sin((i * Math.PI) / Math.max(1, count)));
        nodes.push(ringPos(angle, radius * compress, 1));
        connectors.push({ x1: cx, y1: cy, x2: nodes[i].x, y2: nodes[i].y, dashed: true });
      }
      break;
    }
    case "nova": {
      // Nova cage: radial burst + outer containment cage (Crimson Nova).
      for (let i = 0; i < count; i++) {
        const angle = (360 / count) * i + 22;
        nodes.push(ringPos(angle, radius * 0.86, 1));
        const outer = ringPos(angle, radius + 12);
        connectors.push({ x1: nodes[i].x, y1: nodes[i].y, x2: outer.x, y2: outer.y, dashed: false });
      }
      rings.push({ cx, cy, r: radius + 12, dashed: false, width: 1 });
      break;
    }
    case "aperture": {
      // Machined aperture: offset blade ring (Lunar Titanium).
      for (let i = 0; i < count; i++) {
        const angle = (360 / count) * i;
        nodes.push(ringPos(angle, radius, 1));
        const bx = cx + (radius + 10) * Math.sin(((angle + 18) * Math.PI) / 180);
        const by = cy - (radius + 10) * Math.cos(((angle + 18) * Math.PI) / 180);
        connectors.push({ x1: nodes[i].x, y1: nodes[i].y, x2: bx, y2: by, dashed: false });
      }
      rings.push({ cx, cy, r: radius + 10, dashed: false, width: 1.2 });
      break;
    }
    case "astrolabe": {
      // Astrolabe: nested instrument rings + coordinate spokes (Sapphire).
      for (let i = 0; i < count; i++) {
        const angle = (360 / count) * i;
        nodes.push(ringPos(angle, radius, 1));
        connectors.push({ x1: cx, y1: cy, x2: nodes[i].x, y2: nodes[i].y, dashed: false });
      }
      rings.push({ cx, cy, r: radius * 0.66, dashed: false, width: 0.8 });
      rings.push({ cx, cy, r: radius + 10, dashed: true, width: 0.8 });
      break;
    }
    case "dunes": {
      // Flowing dunes: wave-offset rows (Astral Dune).
      for (let i = 0; i < count; i++) {
        const angle = -80 + (i * 160) / Math.max(1, count - 1);
        const r = radius + jitter(i, radius * 0.12);
        nodes.push(ringPos(angle, r, 1));
      }
      break;
    }
  }

  return { nodes, connectors, rings, core };
}

/** Validate + fall back: unknown variants render as the orbit baseline. */
export function normalizeVariant(v: string | undefined): GeometryVariant {
  const known: GeometryVariant[] = [
    "orbit", "petals", "dial", "constellation", "spine", "eclipse",
    "facets", "orchid", "ice", "lens", "nova", "aperture", "astrolabe", "dunes",
  ];
  return (known as string[]).includes(v ?? "") ? (v as GeometryVariant) : "orbit";
}
