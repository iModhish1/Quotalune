/**
 * QuotaArc's canonical visual tokens.
 *
 * Production intentionally exposes one theme and one orbit composition. The
 * full V6–V8 catalog is preserved by the `archive/v9-orbital-catalog` Git
 * tag, while this module stays small enough to become the stable contract for
 * future token-only themes.
 */

export interface CatalogTheme {
  slug: string;
  name: string;
  attr: string;
  bg: [string, string];
  core: string;
  coreEdge: string;
  accent: string;
  accent2: string;
  accent3: string;
  hairline: string;
  providerColors: Record<string, string>;
  /**
   * Archived diagnostics still understand the old variants, but the only
   * production value is `orbit`. A future theme-token API will remove this
   * compatibility field entirely once those diagnostics leave the app tree.
   */
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
  /** Fixed, bounded transition duration for the canonical surface. */
  expansionMs: number;
}

const CANONICAL_PROVIDER_COLORS: Record<string, string> = {
  openai: "#10a37f",
  claude: "#e0a884",
  gemini: "#7aa2f7",
  llama: "#5b8def",
  mistral: "#ff8a3d",
  deepseek: "#4d6bfe",
  perplexity: "#20b8cd",
};

export const CANONICAL_THEME: CatalogTheme = {
  slug: "01-obsidian-orbit",
  name: "Obsidian Orbit",
  attr: "obsidian-orbit",
  bg: ["#0b1220", "#05070b"],
  core: "#0d141d",
  coreEdge: "#1c2634",
  accent: "#2dd4bf",
  accent2: "#5b8def",
  accent3: "#8b5cf6",
  hairline: "rgba(200,214,230,0.10)",
  providerColors: CANONICAL_PROVIDER_COLORS,
  geometry: "orbit",
  expansionMs: 180,
};

/** The complete production selection. There is intentionally no gallery list. */
export const THEME_CATALOG: readonly CatalogTheme[] = [CANONICAL_THEME];

/**
 * Compatibility inventory only. Its detailed token data lives in the archive
 * tag and is excluded from the production bundle.
 */
export const ARCHIVED_THEME_SLUGS = [
  "02-aurora-bloom",
  "03-solar-ember",
  "04-porcelain-halo",
  "05-noir-constellation",
  "06-halo-spine",
  "07-eclipse-dial",
  "08-prism-zenith",
  "09-quantum-orchid",
  "10-celestial-ice",
  "11-emerald-singularity",
  "12-crimson-nova",
  "13-lunar-titanium",
  "14-sapphire-observatory",
  "15-astral-dune",
] as const;

export function catalogBySlug(slug: string): CatalogTheme | undefined {
  return slug === CANONICAL_THEME.slug || slug === CANONICAL_THEME.attr
    ? CANONICAL_THEME
    : undefined;
}

/** Provider energy uses semantic provider colors over the canonical material. */
export function providerColor(theme: CatalogTheme, providerId: string): string {
  return theme.providerColors[providerId] ?? theme.accent;
}
