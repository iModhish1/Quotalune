import type { CatalogTheme } from "./themeCatalog";

type ThemeSeed = {
  slug: string;
  name: string;
  light?: boolean;
  bg: [string, string];
  core: string;
  edge: string;
  accents: [string, string, string];
  text: string;
  muted: string;
  radius: number;
  iconRadius: string;
  edgeStyle?: "solid" | "double";
  font?: "sans" | "mono";
  signature: string;
  finish: string;
  ornament: string;
  frame: string;
  frameBorder: string;
  connector: string;
  duration: number;
  cap?: "round" | "butt" | "square";
};

export const LIBRARY_THEME_SLUGS = [
  "02-graphite-precision",
  "03-midnight-glass",
  "05-stealth-mono",
  "06-aurora-prism",
  "07-solar-pearl",
  "08-oceanic-glass",
  "09-rose-quartz",
  "10-verdant-halo",
  "11-copper-ember",
  "12-arctic-spectrum",
  "13-lavender-mist",
  "14-sapphire-circuit",
  "15-crimson-atelier",
  "17-jade-pavilion",
  "33-ink-and-gold",
] as const;

const SEEDS: readonly ThemeSeed[] = [
  {slug:"02-graphite-precision",name:"Graphite Precision",bg:["#242b33","#090c10"],core:"#11161c",edge:"#65717d",accents:["#58d8ee","#b9c5cf","#7b8c9a"],text:"#f2f6f8",muted:"#a9b3bc",radius:12,iconRadius:"8px",edgeStyle:"double",font:"mono",signature:"Machined caliper",finish:"linear-gradient(135deg,#ffffff12,transparent 38%),repeating-linear-gradient(90deg,#ffffff08 0 1px,transparent 1px 9px)",ornament:"linear-gradient(90deg,transparent 49%,#72d8e516 50%,transparent 51%)",frame:"linear-gradient(145deg,#56616b,#080a0d 68%)",frameBorder:"#b9c8d3",connector:"#52616b",duration:155,cap:"square"},
  {slug:"03-midnight-glass",name:"Midnight Glass",bg:["#17254c","#080b21"],core:"#0b1028",edge:"#485991",accents:["#62ddf4","#8c79ff","#f0a45b"],text:"#f3f5ff",muted:"#aeb8dd",radius:26,iconRadius:"48%",signature:"Midnight refraction",finish:"linear-gradient(145deg,#b8d8ff18,transparent 42%),radial-gradient(circle at 82% 12%,#855dff30,transparent 48%)",ornament:"radial-gradient(ellipse at 12% 0%,#57d8ee28,transparent 58%)",frame:"radial-gradient(circle at 30% 16%,#4d5eaf,#090d2a 70%)",frameBorder:"#a8b8ff",connector:"#303b71",duration:220},
  {slug:"05-stealth-mono",name:"Stealth Mono",bg:["#1b1e21","#050607"],core:"#0b0d0f",edge:"#454b50",accents:["#d8e0e5","#91a5b2","#6ed7ea"],text:"#f0f2f3",muted:"#939ba0",radius:12,iconRadius:"6px",font:"mono",signature:"Carbon radar",finish:"linear-gradient(150deg,#ffffff0c,transparent 52%)",ornament:"repeating-linear-gradient(0deg,#ffffff05 0 1px,transparent 1px 6px)",frame:"linear-gradient(145deg,#33383d,#060708)",frameBorder:"#edf2f4",connector:"#3e4448",duration:150,cap:"butt"},
  {slug:"06-aurora-prism",name:"Aurora Prism",bg:["#102d3c","#071021"],core:"#071725",edge:"#3f6b7e",accents:["#54f0c2","#57caff","#cf68ff"],text:"#efffff",muted:"#a9ccd4",radius:24,iconRadius:"45%",signature:"Dichroic comet",finish:"radial-gradient(circle at 12% 4%,#4ff0bd35,transparent 48%),radial-gradient(circle at 96% 100%,#d557ff2e,transparent 54%)",ornament:"conic-gradient(from 205deg at 15% 20%,#55ffc71a,#55bfff14,#d45cff18,#55ffc71a)",frame:"conic-gradient(from 210deg,#37efc0,#318cff,#c24dff,#10243a,#37efc0)",frameBorder:"#b5fff0",connector:"#225a68",duration:230},
  {slug:"07-solar-pearl",name:"Solar Pearl",light:true,bg:["#fff9e8","#eee5cd"],core:"#fffdf6",edge:"#c8b98e",accents:["#f3a51f","#ff7e3a","#343b45"],text:"#24272b",muted:"#676250",radius:24,iconRadius:"50%",signature:"Sunrise pearl",finish:"radial-gradient(circle at 18% 0%,#ffffff 0,transparent 62%),linear-gradient(135deg,#ffd75c24,transparent 55%)",ornament:"repeating-conic-gradient(from 0deg at 50% 15%,#f3ab2015 0 2deg,transparent 2deg 18deg)",frame:"radial-gradient(circle at 32% 22%,#ffffff,#efd47e 54%,#c57824)",frameBorder:"#9c651b",connector:"#b99955",duration:185},
  {slug:"08-oceanic-glass",name:"Oceanic Glass",light:true,bg:["#e9fbfb","#cce7ec"],core:"#f8ffff",edge:"#79aebb",accents:["#159bc5","#41cbb7","#385ee8"],text:"#081f28",muted:"#405e68",radius:28,iconRadius:"50%",signature:"Tidal waterglass",finish:"linear-gradient(145deg,#ffffffee,transparent 43%),radial-gradient(ellipse at 88% 100%,#36a7ca2e,transparent 58%)",ornament:"radial-gradient(ellipse at 14% 0%,#55d9cb30,transparent 54%)",frame:"radial-gradient(circle at 30% 18%,#ffffff,#75d7df 54%,#176c94)",frameBorder:"#196a89",connector:"#72aeb8",duration:225},
  {slug:"09-rose-quartz",name:"Rose Quartz",light:true,bg:["#fff0f5","#ead9e2"],core:"#fff8fb",edge:"#c78fa7",accents:["#d64c8a","#8c4d99","#ed88a7"],text:"#29131e",muted:"#6f4e5d",radius:18,iconRadius:"38%",edgeStyle:"double",signature:"Quartz petal",finish:"linear-gradient(128deg,#ffffff 0 22%,transparent 23% 58%,#d9518730 59% 60%,transparent 61%)",ornament:"conic-gradient(from 20deg at 12% 14%,#ffffff66,#e55a8c18,#7c58a81c,#ffffff66)",frame:"conic-gradient(from 25deg,#fff,#e98eb2,#8f5ba9,#f7c6d8,#fff)",frameBorder:"#94456e",connector:"#ba8299",duration:215},
  {slug:"10-verdant-halo",name:"Verdant Halo",light:true,bg:["#f4f8eb","#dce8d2"],core:"#fbfff8",edge:"#88a77d",accents:["#278c62","#73b97e","#a0a948"],text:"#0b261b",muted:"#496556",radius:28,iconRadius:"50%",signature:"Bio-ceramic leaf",finish:"radial-gradient(ellipse at 18% 0%,#ffffff 0,transparent 60%),linear-gradient(145deg,#64a76e20,transparent 55%)",ornament:"radial-gradient(ellipse at 8% 100%,#4d9a6430,transparent 52%)",frame:"radial-gradient(ellipse at 36% 16%,#ffffff,#82b88f 55%,#205e45)",frameBorder:"#2a664b",connector:"#7b9b72",duration:210},
  {slug:"11-copper-ember",name:"Copper Ember",bg:["#38251c","#100907"],core:"#1a100c",edge:"#9a6748",accents:["#e48a3e","#f5b96d","#c65a32"],text:"#fff3e8",muted:"#ceb19e",radius:12,iconRadius:"9px",edgeStyle:"double",font:"mono",signature:"Blackened forge",finish:"linear-gradient(120deg,#f5a35c22,transparent 43%),repeating-linear-gradient(96deg,#f5bd8b0d 0 1px,transparent 1px 7px)",ornament:"radial-gradient(circle at 10% 12%,#ff9a452c,transparent 46%)",frame:"repeating-linear-gradient(105deg,#9b5a34 0 2px,#20110b 2px 8px)",frameBorder:"#ffc18c",connector:"#74462f",duration:165,cap:"square"},
  {slug:"12-arctic-spectrum",name:"Arctic Spectrum",light:true,bg:["#f2fbff","#dbe9f4"],core:"#fbfdff",edge:"#86a6c8",accents:["#3976ee","#79b7ff","#9b82e8"],text:"#0d2139",muted:"#496079",radius:20,iconRadius:"44%",edgeStyle:"double",signature:"Frost crystal",finish:"linear-gradient(145deg,#ffffff 0 28%,transparent 29% 64%,#6b8fe520 65%),radial-gradient(circle at 90% 0%,#9f8eff28,transparent 48%)",ornament:"repeating-conic-gradient(from 0deg at 12% 18%,#4e88df12 0 1deg,transparent 1deg 30deg)",frame:"conic-gradient(from 15deg,#ffffff,#78c9ff,#776eef,#d8f5ff,#ffffff)",frameBorder:"#315b9b",connector:"#7f9fbd",duration:190},
  {slug:"13-lavender-mist",name:"Lavender Mist",light:true,bg:["#f7f3ff","#e4ddf2"],core:"#fcfaff",edge:"#aa99c8",accents:["#8171dd","#a78bef","#6d84d6"],text:"#201733",muted:"#625879",radius:28,iconRadius:"50%",signature:"Mist cloud-ring",finish:"radial-gradient(ellipse at 16% 4%,#ffffff 0,transparent 62%),radial-gradient(ellipse at 92% 100%,#9276dd25,transparent 58%)",ornament:"radial-gradient(circle at 9% 18%,#b58cf329,transparent 45%)",frame:"radial-gradient(circle at 34% 18%,#ffffff,#b7a0e2 58%,#6752a0)",frameBorder:"#675398",connector:"#a293bd",duration:228},
  {slug:"14-sapphire-circuit",name:"Sapphire Circuit",bg:["#153660","#07152d"],core:"#0a1b39",edge:"#4476a8",accents:["#26d4ff","#287cff","#a3c4e8"],text:"#eef8ff",muted:"#a9bfd4",radius:12,iconRadius:"7px",font:"mono",signature:"Sapphire signal bus",finish:"linear-gradient(135deg,#5ebeff1d,transparent 42%),repeating-linear-gradient(90deg,#56bfff0a 0 1px,transparent 1px 10px)",ornament:"linear-gradient(90deg,transparent 14%,#2cd8ff1b 14% 15%,transparent 15% 84%,#2cd8ff18 84% 85%,transparent 85%)",frame:"linear-gradient(145deg,#1d78c9,#07152d 68%)",frameBorder:"#73e5ff",connector:"#1e5880",duration:175,cap:"butt"},
  {slug:"15-crimson-atelier",name:"Crimson Atelier",bg:["#491b2a","#16070d"],core:"#230c14",edge:"#9f3e59",accents:["#ee4966","#c82d50","#f2c2ba"],text:"#fff4f3",muted:"#d1a9ad",radius:22,iconRadius:"42%",signature:"Lacquered fan",finish:"linear-gradient(150deg,#ffb8b91c,transparent 45%),radial-gradient(ellipse at 90% 0%,#d02b502b,transparent 54%)",ornament:"repeating-conic-gradient(from 220deg at 8% 100%,#ff6c8212 0 2deg,transparent 2deg 14deg)",frame:"radial-gradient(circle at 32% 18%,#a22e4d,#210911 68%)",frameBorder:"#ff9aa8",connector:"#713044",duration:225},
  {slug:"17-jade-pavilion",name:"Jade Pavilion",light:true,bg:["#eff9ef","#d3e8da"],core:"#f8fff9",edge:"#79a98b",accents:["#24966e","#68c49a","#486f57"],text:"#0a291c",muted:"#456454",radius:16,iconRadius:"12px",edgeStyle:"double",signature:"Celadon pavilion",finish:"linear-gradient(145deg,#ffffff 0 30%,transparent 31%),radial-gradient(ellipse at 90% 100%,#4daa7830,transparent 56%)",ornament:"repeating-linear-gradient(90deg,#2e8e6510 0 1px,transparent 1px 12px)",frame:"linear-gradient(145deg,#f7fff7,#67b78e 55%,#1f664a)",frameBorder:"#245f47",connector:"#739d80",duration:205},
  {slug:"33-ink-and-gold",name:"Ink & Gold",bg:["#252016","#080705"],core:"#11100c",edge:"#8a7339",accents:["#d2b458","#f0d987","#8f7840"],text:"#fff7df",muted:"#baaE8d",radius:14,iconRadius:"50%",edgeStyle:"double",font:"mono",signature:"Gilded astrolabe",finish:"linear-gradient(145deg,#e8cb6518,transparent 45%),repeating-radial-gradient(circle at 15% 10%,#d6b95610 0 1px,transparent 1px 8px)",ornament:"radial-gradient(circle at 10% 14%,#efd46724,transparent 46%)",frame:"conic-gradient(from 20deg,#6b5523,#e1c66b,#151006,#8f7531,#6b5523)",frameBorder:"#f4de8d",connector:"#66552d",duration:200,cap:"square"},
] as const;

export function createLibraryThemes(providerColors: Record<string, string>): readonly CatalogTheme[] {
  return SEEDS.map((seed, index) => ({
    slug: seed.slug,
    attr: seed.slug,
    name: seed.name,
    bg: seed.bg,
    core: seed.core,
    coreEdge: seed.edge,
    accent: seed.accents[0],
    accent2: seed.accents[1],
    accent3: seed.accents[2],
    hairline: seed.light ? "rgba(30,55,75,.13)" : "rgba(215,230,245,.12)",
    providerColors,
    geometry: "orbit",
    expansionMs: seed.duration,
    identity: {
      detailRadius: seed.radius,
      edgeStyle: seed.edgeStyle ?? "solid",
      font: seed.font ?? "sans",
      relief: seed.light
        ? "inset 0 1px 0 #ffffff, inset 0 -2px 4px #4a607326, 0 12px 26px #39566b24"
        : "inset 0 1px 0 #ffffff32, inset 0 -2px 5px #0008, 0 14px 32px #0009",
      rimSize: seed.edgeStyle === "double" ? 2 : 1,
      iconRadius: seed.iconRadius,
      labelTracking: seed.font === "mono" ? ".055em" : index % 3 === 0 ? ".012em" : "0",
      ornament: seed.ornament,
      accentHalo: `0 0 0 ${seed.edgeStyle === "double" ? 2 : 1}px ${seed.accents[0]}45,0 0 20px ${seed.accents[0]}32`,
      signature: seed.signature,
      inlay: `${seed.edgeStyle === "double" ? "3px double" : "1px solid"} ${seed.accents[1]}45`,
      meterCap: seed.cap ?? "round",
      connector: seed.connector,
      markFilter: `drop-shadow(0 0 4px ${seed.frameBorder}b8) drop-shadow(0 2px 3px ${seed.light ? "#52657766" : "#000"})`,
      markFrame: seed.frame,
      markBorder: seed.frameBorder,
      markBlend: seed.light ? "soft-light" : "screen",
    },
    material: {
      text: seed.text,
      muted: seed.muted,
      finish: seed.finish,
      sheen: seed.light ? "#ffffff" : `${seed.accents[1]}66`,
      ...(seed.light ? { light: true } : {}),
    },
  }));
}
