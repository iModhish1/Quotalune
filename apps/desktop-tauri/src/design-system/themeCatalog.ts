/**
 * QuotaArc theme catalog — 15 legendary themes.
 *
 * Source of truth for identity: the owner's theme catalog
 * (slug/identity/palette/geometry/motion per theme). Each entry carries
 * bounded visual tokens for the orbital system: deep background, surface
 * tones, accent, hairline, provider energy palette, and a geometry variant
 * that shapes the radial composition (fan / petals / dial / constellation /
 * spine / eclipse / facets / orchid / ice / lens / nova / aperture /
 * astrolabe / dunes / orbit).
 *
 * Providers (canonical seven): openai, claude, gemini, llama, mistral,
 * deepseek, perplexity.
 */

export interface CatalogTheme {
  slug: string;
  name: string;
  attr: string;
  /** Deep background gradient stops (wallpaper-adjacent tones). */
  bg: [string, string];
  /** Core/housing body tone. */
  core: string;
  coreEdge: string;
  /** Primary accent (arc energy, focus). */
  accent: string;
  /** Hairline/connector tone. */
  hairline: string;
  /** Provider node energy palette. */
  providerColors: Record<string, string>;
  /** Geometry variant driving the radial composition. */
  geometry:
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
  /** Expansion timing (ms) from the theme's motion language. */
  expansionMs: number;
}

const P = {
  openai: "#10a37f",
  claude: "#d97757",
  gemini: "#7aa2f7",
  llama: "#5b8def",
  mistral: "#ff8a3d",
  deepseek: "#4d6bfe",
  perplexity: "#20b8cd",
};

export const THEME_CATALOG: CatalogTheme[] = [
  {
    slug: "01-obsidian-orbit", name: "Obsidian Orbit", attr: "obsidian-orbit",
    bg: ["#0b1220", "#05070b"], core: "#0d141d", coreEdge: "#1c2634",
    accent: "#2dd4bf", hairline: "rgba(200,214,230,0.10)",
    providerColors: { ...P, claude: "#e0a884" },
    geometry: "orbit", expansionMs: 240,
  },
  {
    slug: "02-aurora-bloom", name: "Aurora Bloom", attr: "aurora-bloom",
    bg: ["#131b3a", "#0a0d1f"], core: "#151d40", coreEdge: "#2b3a72",
    accent: "#67e8f9", hairline: "rgba(147,197,253,0.12)",
    providerColors: { openai: "#67e8f9", claude: "#f0abfc", gemini: "#a5b4fc", llama: "#5eead4", mistral: "#fbbf24", deepseek: "#818cf8", perplexity: "#38bdf8" },
    geometry: "petals", expansionMs: 280,
  },
  {
    slug: "03-solar-ember", name: "Solar Ember", attr: "solar-ember",
    bg: ["#191210", "#0b0705"], core: "#1d1510", coreEdge: "#3d2a1a",
    accent: "#f59e0b", hairline: "rgba(251,191,36,0.12)",
    providerColors: { openai: "#34d399", claude: "#fb923c", gemini: "#fcd34d", llama: "#f59e0b", mistral: "#ea580c", deepseek: "#d97706", perplexity: "#fbbf24" },
    geometry: "dial", expansionMs: 220,
  },
  {
    slug: "04-porcelain-halo", name: "Porcelain Halo", attr: "porcelain-halo",
    bg: ["#f4f7fb", "#e2e9f2"], core: "#ffffff", coreEdge: "#d5deea",
    accent: "#3b82f6", hairline: "rgba(30,58,95,0.10)",
    providerColors: P,
    geometry: "orbit", expansionMs: 260,
  },
  {
    slug: "05-noir-constellation", name: "Noir Constellation", attr: "noir-constellation",
    bg: ["#0a0a0d", "#030304"], core: "#101014", coreEdge: "#23232b",
    accent: "#d4b483", hairline: "rgba(212,180,131,0.14)",
    providerColors: { openai: "#34d399", claude: "#e0a884", gemini: "#a5b4fc", llama: "#7aa2f7", mistral: "#d4b483", deepseek: "#8b5cf6", perplexity: "#5eead4" },
    geometry: "constellation", expansionMs: 300,
  },
  {
    slug: "06-halo-spine", name: "Halo Spine", attr: "halo-spine",
    bg: ["#120e22", "#07050f"], core: "#171226", coreEdge: "#322650",
    accent: "#c084fc", hairline: "rgba(192,132,252,0.14)",
    providerColors: { openai: "#22d3ee", claude: "#f0abfc", gemini: "#818cf8", llama: "#5b8def", mistral: "#fbbf24", deepseek: "#34d399", perplexity: "#c084fc" },
    geometry: "spine", expansionMs: 230,
  },
  {
    slug: "07-eclipse-dial", name: "Eclipse Dial", attr: "eclipse-dial",
    bg: ["#08080a", "#020203"], core: "#0c0c0f", coreEdge: "#26262e",
    accent: "#f8fafc", hairline: "rgba(248,250,252,0.10)",
    providerColors: { openai: "#34d399", claude: "#fb923c", gemini: "#60a5fa", llama: "#7aa2f7", mistral: "#f59e0b", deepseek: "#2dd4bf", perplexity: "#e2e8f0" },
    geometry: "eclipse", expansionMs: 250,
  },
  {
    slug: "08-prism-zenith", name: "Prism Zenith", attr: "prism-zenith",
    bg: ["#1a1440", "#0c0924"], core: "#221a4d", coreEdge: "#453a85",
    accent: "#a78bfa", hairline: "rgba(196,181,253,0.14)",
    providerColors: { openai: "#5eead4", claude: "#f0abfc", gemini: "#a5b4fc", llama: "#93c5fd", mistral: "#fcd34d", deepseek: "#818cf8", perplexity: "#67e8f9" },
    geometry: "facets", expansionMs: 280,
  },
  {
    slug: "09-quantum-orchid", name: "Quantum Orchid", attr: "quantum-orchid",
    bg: ["#160b26", "#0a0512"], core: "#1f1033", coreEdge: "#3d2058",
    accent: "#e879f9", hairline: "rgba(232,121,249,0.13)",
    providerColors: { openai: "#2dd4bf", claude: "#f0abfc", gemini: "#c084fc", llama: "#818cf8", mistral: "#fda4af", deepseek: "#22d3ee", perplexity: "#e879f9" },
    geometry: "orchid", expansionMs: 300,
  },
  {
    slug: "10-celestial-ice", name: "Celestial Ice", attr: "celestial-ice",
    bg: ["#0b1526", "#04070f"], core: "#0f1c30", coreEdge: "#1f3a5c",
    accent: "#7dd3fc", hairline: "rgba(125,211,252,0.13)",
    providerColors: { openai: "#5eead4", claude: "#bae6fd", gemini: "#7dd3fc", llama: "#93c5fd", mistral: "#38bdf8", deepseek: "#67e8f9", perplexity: "#e0f2fe" },
    geometry: "ice", expansionMs: 320,
  },
  {
    slug: "11-emerald-singularity", name: "Emerald Singularity", attr: "emerald-singularity",
    bg: ["#07130d", "#020604"], core: "#0c1a12", coreEdge: "#1a3a28",
    accent: "#34d399", hairline: "rgba(52,211,153,0.13)",
    providerColors: { openai: "#34d399", claude: "#a7f3d0", gemini: "#6ee7b7", llama: "#5eead4", mistral: "#fcd34d", deepseek: "#10b981", perplexity: "#a7f3d0" },
    geometry: "lens", expansionMs: 280,
  },
  {
    slug: "12-crimson-nova", name: "Crimson Nova", attr: "crimson-nova",
    bg: ["#170a0c", "#0a0304"], core: "#210f12", coreEdge: "#48202a",
    accent: "#f87171", hairline: "rgba(248,113,113,0.14)",
    providerColors: { openai: "#34d399", claude: "#fda4af", gemini: "#93c5fd", llama: "#7aa2f7", mistral: "#fb923c", deepseek: "#f87171", perplexity: "#fca5a5" },
    geometry: "nova", expansionMs: 210,
  },
  {
    slug: "13-lunar-titanium", name: "Lunar Titanium", attr: "lunar-titanium",
    bg: ["#0c0d10", "#040506"], core: "#14161a", coreEdge: "#2a2d34",
    accent: "#7da2c9", hairline: "rgba(160,180,205,0.12)",
    providerColors: { openai: "#9ca3af", claude: "#d1d5db", gemini: "#93c5fd", llama: "#7da2c9", mistral: "#b0b8c4", deepseek: "#6b7280", perplexity: "#e5e7eb" },
    geometry: "aperture", expansionMs: 240,
  },
  {
    slug: "14-sapphire-observatory", name: "Sapphire Observatory", attr: "sapphire-observatory",
    bg: ["#0a1128", "#03061a"], core: "#101b3c", coreEdge: "#233464",
    accent: "#93c5fd", hairline: "rgba(147,197,253,0.12)",
    providerColors: { openai: "#34d399", claude: "#e0a884", gemini: "#93c5fd", llama: "#7aa2f7", mistral: "#d4b483", deepseek: "#38bdf8", perplexity: "#f8fafc" },
    geometry: "astrolabe", expansionMs: 300,
  },
  {
    slug: "15-astral-dune", name: "Astral Dune", attr: "astral-dune",
    bg: ["#1c1208", "#0b0704"], core: "#241809", coreEdge: "#4d3517",
    accent: "#fbbf24", hairline: "rgba(251,191,36,0.13)",
    providerColors: { openai: "#5eead4", claude: "#fbbf24", gemini: "#93c5fd", llama: "#d97706", mistral: "#fb923c", deepseek: "#2dd4bf", perplexity: "#67e8f9" },
    geometry: "dunes", expansionMs: 320,
  },
];

export function catalogBySlug(slug: string): CatalogTheme | undefined {
  return THEME_CATALOG.find((t) => t.slug === slug || t.attr === slug);
}

/** Provider energy color within a theme (falls back to the theme accent). */
export function providerColor(theme: CatalogTheme, providerId: string): string {
  return theme.providerColors[providerId] ?? theme.accent;
}
