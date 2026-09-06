import { createLibraryThemes } from "./themeCatalogExpansion";

/**
 * QuotaArc's canonical visual tokens.
 *
 * Visual identities are independent of structure selection, modes and placement.
 * Earlier V6–V8 geometry experiments remain archived rather than resurfacing
 * as new material selections.
 */

export interface CatalogTheme {
  /** Surface identity changes internal styling, never quota semantics or placement. */
  identity?: {
    detailRadius:number;
    edgeStyle:'solid'|'double';
    font:'sans'|'mono';
    relief:string;
    rimSize:number;
    iconRadius:string;
    labelTracking:string;
    ornament:string;
    accentHalo:string;
    /** Paint-only signature shared by every structure using this identity. */
    signature:string;
    inlay:string;
    meterCap:'round'|'butt'|'square';
    connector:string;
    markFilter:string;
    markFrame:string;
    markBorder:string;
    markBlend:'screen'|'soft-light'|'color';
  };
  /** Shared visual material; never changes geometry, hit targets or quota semantics. */
  material?: { text: string; muted: string; finish: string; sheen: string; light?: boolean };
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
  identity:{detailRadius:18,edgeStyle:'solid',font:'sans',relief:'inset 0 1px 0 #ffffff28,0 12px 28px #0008',rimSize:1,iconRadius:'50%',labelTracking:'-.01em',ornament:'radial-gradient(circle at 12% 8%,#2dd4bf18,transparent 38%)',accentHalo:'0 0 0 1px #2dd4bf2b,0 0 18px #2dd4bf1f',signature:'Orbital satin',inlay:'1px solid #b9d6ef18',meterCap:'round',connector:'#182431',markFilter:'drop-shadow(0 0 3px #dcecff88) drop-shadow(0 2px 3px #000)',markFrame:'linear-gradient(145deg,#1e4d50,#08121c)',markBorder:'#9af4e4',markBlend:'screen'},
  material:{text:'#f0f4f8',muted:'#aeb9c5',finish:'linear-gradient(145deg,#ffffff0d,transparent 46%),radial-gradient(circle at 86% 12%,#5b8def16,transparent 38%)',sheen:'#d9e7f633'},
};

/** Identities style the selected structure without replacing it or its native footprint. */
export const THEME_CATALOG: readonly CatalogTheme[] = [CANONICAL_THEME,
  {...CANONICAL_THEME,slug:'sapphire-observatory',attr:'sapphire-observatory',name:'Sapphire Observatory',
    expansionMs:210,
    bg:['#102139','#070e1c'],core:'#091426',coreEdge:'#98794c',accent:'#d3b77e',accent2:'#83aff1',accent3:'#83cbc7',
    identity:{detailRadius:20,edgeStyle:'double',font:'sans',relief:'inset 0 1px 0 #ffe3a566,inset 0 -2px 5px #00081788,0 14px 30px #02081399',rimSize:2,iconRadius:'50%',labelTracking:'.015em',ornament:'radial-gradient(circle at 12% 18%,#f0d18e 0 1px,transparent 1.4px),radial-gradient(circle at 88% 76%,#9dc4ff 0 1px,transparent 1.4px)',accentHalo:'0 0 0 2px #cda85c38,0 0 20px #6ea8ff30',signature:'Observatory reticle',inlay:'1px solid #e2c7873d',meterCap:'round',connector:'#806a43',markFilter:'drop-shadow(0 0 4px #e5ca8baa) drop-shadow(0 2px 3px #000)',markFrame:'radial-gradient(circle at 30% 18%,#41608d,#08101e 72%)',markBorder:'#e2c787',markBlend:'screen'},
    material:{text:'#f1eee5',muted:'#bec9d9',finish:'radial-gradient(circle at 8% 12%, #e5c88788 0 1px, transparent 1.4px), radial-gradient(circle at 93% 85%, #e5c88766 0 1px, transparent 1.4px), linear-gradient(125deg, #4b6b9726, transparent 48%, #ac853016)',sheen:'#e8ca8b66'}},
  {...CANONICAL_THEME,slug:'eclipse-ember',attr:'eclipse-ember',name:'Eclipse Ember',
    expansionMs:195,
    bg:['#211b18','#080809'],core:'#101010',coreEdge:'#bb906a',accent:'#efb76e',accent2:'#d6dbe6',accent3:'#a7c7da',
    identity:{detailRadius:22,edgeStyle:'solid',font:'sans',relief:'inset 0 1px 0 #fff1dfaa,inset 0 -2px 4px #d77c2733,0 15px 34px #120600aa',rimSize:1.5,iconRadius:'42%',labelTracking:'0',ornament:'radial-gradient(ellipse at 50% -12%,#ffcc8a30,transparent 54%)',accentHalo:'0 0 0 1px #ffd7a45c,0 0 22px #ef9c4938',signature:'Eclipse corona',inlay:'1px solid #efb76e35',meterCap:'round',connector:'#68472f',markFilter:'drop-shadow(0 0 5px #ffc478aa) drop-shadow(0 2px 4px #120600)',markFrame:'radial-gradient(circle at 50% 12%,#6d3a1f,#0c0908 72%)',markBorder:'#ffd7a4',markBlend:'screen'},
    material:{text:'#fff4e9',muted:'#cbbeb3',finish:'radial-gradient(ellipse at 50% 0%, #f4cb8d22, transparent 55%), linear-gradient(150deg, #ffffff08, transparent 60%)',sheen:'#ffe9cc88'}},
  {...CANONICAL_THEME,slug:"aurora-bloom-material",attr:"aurora-bloom-material",name:"Aurora Bloom",
    expansionMs:225,
    identity:{detailRadius:24,edgeStyle:'solid',font:'sans',relief:'inset 0 1px 0 #d5ceff66,inset 0 -2px 5px #574baa35,0 14px 34px #04061db0',rimSize:1,iconRadius:'46%',labelTracking:'.005em',ornament:'radial-gradient(ellipse at 6% 0%,#8f75ce40,transparent 58%),radial-gradient(ellipse at 100% 100%,#58b8c43d,transparent 62%)',accentHalo:'0 0 0 1px #a99cff48,0 0 24px #7969df42',signature:'Aurora bloom',inlay:'1px solid #aa9cff36',meterCap:'round',connector:'#4d477d',markFilter:'drop-shadow(0 0 5px #ad9effaa) drop-shadow(0 2px 4px #060722)',markFrame:'linear-gradient(145deg,#493b89,#0a1025)',markBorder:'#c7bdff',markBlend:'screen'},
    bg:["#171c39","#080d1c"],core:"#090e20",coreEdge:"#62629a",accent:"#8da9ed",accent2:"#8f75ce",accent3:"#58b8c4",
    material:{text:"#f0f2ff",muted:"#b9c1dd",finish:"radial-gradient(ellipse at 8% 0%, #6454ab55, transparent 65%), radial-gradient(ellipse at 100% 100%, #2f9caf44, transparent 65%)",sheen:"#bac6ff55"}},
  {...CANONICAL_THEME,slug:"solar-ember-material",attr:"solar-ember-material",name:"Solar Ember",
    expansionMs:165,
    identity:{detailRadius:14,edgeStyle:'double',font:'mono',relief:'inset 0 2px 0 #efc59555,inset 0 -2px 0 #00000066,0 12px 28px #11050099',rimSize:2,iconRadius:'10px',labelTracking:'.055em',ornament:'repeating-linear-gradient(115deg,#ffd6a509 0 1px,transparent 1px 8px)',accentHalo:'0 0 0 2px #d5af8035,0 0 16px #d9803e2d',signature:'Solar detent',inlay:'1px dashed #d5af8045',meterCap:'square',connector:'#624730',markFilter:'drop-shadow(0 0 3px #ffd09a99) drop-shadow(0 2px 3px #140600)',markFrame:'repeating-linear-gradient(115deg,#704728 0 2px,#1a100b 2px 8px)',markBorder:'#efc595',markBlend:'screen'},
    bg:["#38281f","#120d0b"],core:"#17100c",coreEdge:"#84664b",accent:"#d5af80",accent2:"#ad8267",accent3:"#b6a18a",
    material:{text:"#fff3e7",muted:"#d2bbaa",finish:"radial-gradient(ellipse at 10% 0%, #b7793544, transparent 70%), linear-gradient(120deg, #f0c48c12, transparent 40%, #90502618)",sheen:"#ffd9a755"}},
  {...CANONICAL_THEME,slug:"ceramic-pearl-material",attr:"ceramic-pearl-material",name:"Ceramic Pearl",
    expansionMs:205,
    identity:{detailRadius:26,edgeStyle:'solid',font:'sans',relief:'inset 0 2px 0 #ffffff,inset 0 -2px 3px #66798b30,0 12px 25px #51616f26',rimSize:1,iconRadius:'50%',labelTracking:'-.005em',ornament:'radial-gradient(ellipse at 20% 0%,#ffffffee,transparent 60%)',accentHalo:'0 0 0 1px #ffffff,0 0 18px #476a8030',signature:'Ceramic halo',inlay:'1px solid #ffffff',meterCap:'round',connector:'#a4b0b8',markFilter:'drop-shadow(0 0 1px #fff) drop-shadow(0 1px 2px #263642aa)',markFrame:'linear-gradient(145deg,#ffffff,#9eacb8)',markBorder:'#ffffff',markBlend:'soft-light'},
    bg:["#f8f7f4","#e3e8eb"],core:"#edf0f2",coreEdge:"#8f9ca5",accent:"#3a607a",accent2:"#655a82",accent3:"#3e7476",
    material:{text:"#18232d",muted:"#475763",finish:"radial-gradient(ellipse at 10% 0%, #ffffffee, transparent 65%), linear-gradient(120deg, #d2c8e333, transparent 50%, #bbdeda44)",sheen:"#ffffff" ,light:true}},
  {...CANONICAL_THEME,slug:"smoked-silver",attr:"smoked-silver",name:"Smoked Silver",
    expansionMs:150,
    identity:{detailRadius:16,edgeStyle:'double',font:'sans',relief:'inset 0 1px 0 #eef5ff88,inset 0 -1px 0 #080b10,0 13px 30px #000a',rimSize:2,iconRadius:'8px',labelTracking:'.025em',ornament:'repeating-linear-gradient(105deg,#eef5ff0a 0 1px,transparent 1px 6px)',accentHalo:'0 0 0 2px #dbe5f02c,0 0 16px #aab9ca24',signature:'Titanium shutter',inlay:'3px double #dbe5f025',meterCap:'butt',connector:'#505963',markFilter:'drop-shadow(0 0 3px #e7eef7aa) drop-shadow(0 2px 3px #000)',markFrame:'linear-gradient(145deg,#56616f,#090c10)',markBorder:'#e0e8f1',markBlend:'screen'},
    bg:["#25292f","#090b0e"],core:"#111419",coreEdge:"#454d58",accent:"#c4cdd8",accent2:"#8e9bab",accent3:"#657181",
    material:{text:'#f2f5f8',muted:'#abb5c0',finish:'linear-gradient(150deg,#ffffff13,transparent 42%),repeating-linear-gradient(100deg,#ffffff07 0 1px,transparent 1px 7px)',sheen:'#eef5ff55'},
    providerColors:CANONICAL_PROVIDER_COLORS},
  {...CANONICAL_THEME,slug:"tidal-glass",attr:"tidal-glass",name:"Tidal Glass",
    expansionMs:230,
    identity:{detailRadius:28,edgeStyle:'solid',font:'sans',relief:'inset 0 1px 0 #bcfff488,inset 0 -3px 8px #39b9bd22,0 16px 34px #001014a8',rimSize:1,iconRadius:'50%',labelTracking:'.01em',ornament:'radial-gradient(ellipse at 8% 10%,#82e5d14a,transparent 48%),radial-gradient(ellipse at 95% 90%,#6f9bc53d,transparent 55%)',accentHalo:'0 0 0 1px #98e8dc45,0 0 24px #4fb9bc3b',signature:'Tidal caustic',inlay:'1px solid #98e8dc36',meterCap:'round',connector:'#26545a',markFilter:'drop-shadow(0 0 5px #9af5e6aa) drop-shadow(0 2px 4px #001418)',markFrame:'radial-gradient(circle at 30% 20%,#347f82,#07151b 70%)',markBorder:'#a7fff1',markBlend:'screen'},
    bg:["#142c31","#060d12"],core:"#0a191f",coreEdge:"#31545b",accent:"#78c9c0",accent2:"#8daed1",accent3:"#9aa5c9",
    material:{text:'#eafaf7',muted:'#a7c7c7',finish:'linear-gradient(145deg,#bafff11c,transparent 44%),radial-gradient(ellipse at 80% 100%,#4da7c52e,transparent 60%)',sheen:'#b7fff266'},
    providerColors:CANONICAL_PROVIDER_COLORS},
  {...CANONICAL_THEME,slug:"ember-alloy",attr:"ember-alloy",name:"Ember Alloy",
    expansionMs:170,
    identity:{detailRadius:12,edgeStyle:'double',font:'mono',relief:'inset 0 2px 0 #ffd4ab66,inset 0 -2px 0 #08050288,0 12px 28px #080200a8',rimSize:2.5,iconRadius:'7px',labelTracking:'.065em',ornament:'repeating-linear-gradient(45deg,#f6bd8710 0 1px,transparent 1px 9px),repeating-linear-gradient(-45deg,#ffffff06 0 1px,transparent 1px 11px)',accentHalo:'0 0 0 2px #d4a1793a,0 0 14px #d77b3d2b',signature:'Alloy facet',inlay:'1px dashed #d4a17945',meterCap:'square',connector:'#654632',markFilter:'drop-shadow(0 0 3px #ffc28e99) drop-shadow(0 2px 3px #130500)',markFrame:'repeating-linear-gradient(45deg,#75472d 0 2px,#170d08 2px 9px)',markBorder:'#ffd0a8',markBlend:'screen'},
    bg:["#30241f","#100b09"],core:"#1c1411",coreEdge:"#634a3c",accent:"#d4a179",accent2:"#bca891",accent3:"#9eaaa4",
    material:{text:'#fff1e5',muted:'#ccb8a8',finish:'linear-gradient(145deg,#ffd9b51a,transparent 42%),repeating-linear-gradient(45deg,#ffffff08 0 1px,transparent 1px 8px)',sheen:'#ffd1a855'},
    providerColors:CANONICAL_PROVIDER_COLORS},
  ...createLibraryThemes(CANONICAL_PROVIDER_COLORS),
];

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
  return THEME_CATALOG.find(theme=>theme.slug===slug || theme.attr===slug);
}

/** Provider energy uses semantic provider colors over the canonical material. */
export function providerColor(theme: CatalogTheme, providerId: string): string {
  return theme.providerColors[providerId === "codex" ? "openai" : providerId] ?? theme.accent;
}
