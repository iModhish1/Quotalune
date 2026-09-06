import type {ProviderPresentationIdentity} from './limitPresentation';

export interface ProviderPresentationIdentityTokens {
  text?:string;
  muted?:string;
  track?:string;
  /** Opaque color beneath decorative gradients; enables deterministic contrast checks. */
  contrastBase?:string;
}

export interface ProviderPresentationSemanticTokens {
  warning:string;
  critical:string;
  exhausted:string;
}

const DARK_PLATE_SEMANTICS:ProviderPresentationSemanticTokens={warning:'#ffd166',critical:'#ff9aa8',exhausted:'#ffffff'};
const LIGHT_PLATE_SEMANTICS:ProviderPresentationSemanticTokens={warning:'#8a5200',critical:'#a61b32',exhausted:'#111827'};

export const PROVIDER_PRESENTATION_IDENTITY_TOKENS:Record<ProviderPresentationIdentity,ProviderPresentationIdentityTokens>={
  adaptive:{},
  precision:{text:'#f3f6f8',muted:'#b8c2ca',track:'#36414a',contrastBase:'#10161c'},
  glass:{text:'#f3f8ff',muted:'#b4c7dd',track:'#38516b',contrastBase:'#101b2a'},
  pearl:{text:'#15242e',muted:'#526573',track:'#bac7ce',contrastBase:'#dfe8ec'},
  prism:{text:'#ffffff',muted:'#c8c4e8',track:'#494563',contrastBase:'#35235e'},
  mono:{text:'#f2f2f2',muted:'#b8b8b8',track:'#454545',contrastBase:'#151515'},
  signal:{text:'#dff9ff',muted:'#8fbccc',track:'#17435a',contrastBase:'#071928'},
  luxe:{text:'#fff7db',muted:'#c5b88a',track:'#4a4024',contrastBase:'#0d0b07'},
  frost:{text:'#102b32',muted:'#49666d',track:'#afcbd0',contrastBase:'#e8f5f7'},
  ember:{text:'#fff2e8',muted:'#d6aa91',track:'#633521',contrastBase:'#21100b'},
  jade:{text:'#e8fff7',muted:'#9ed2c1',track:'#174b3c',contrastBase:'#071a15'},
  rose:{text:'#fff0f6',muted:'#d9a5ba',track:'#663046',contrastBase:'#2a0f1a'},
  cobalt:{text:'#f2f7ff',muted:'#aac2ed',track:'#243f76',contrastBase:'#08142d'},
  bronze:{text:'#fff4df',muted:'#d7bb8a',track:'#5b4629',contrastBase:'#1e160e'},
  paper:{text:'#241f18',muted:'#6c6254',track:'#c6bbab',contrastBase:'#f4efe5'},
  ultraviolet:{text:'#f7efff',muted:'#c7ace4',track:'#503273',contrastBase:'#170b2b'},
  midnight:{text:'#f0f6ff',muted:'#9fb2c9',track:'#253954',contrastBase:'#07101f'},
  aerogel:{text:'#12312e',muted:'#4c6f69',track:'#b7d7d0',contrastBase:'#e7f4f0'},
  porcelain:{text:'#142a4a',muted:'#536985',track:'#b7c8dc',contrastBase:'#f4f7fb'},
  champagne:{text:'#302416',muted:'#78664f',track:'#d6c3a5',contrastBase:'#f6eddf'},
  terracotta:{text:'#fff3eb',muted:'#d5aa96',track:'#714230',contrastBase:'#2c1510'},
  cyberlime:{text:'#efffd7',muted:'#b9dc83',track:'#415c22',contrastBase:'#101b08'},
  graphite:{text:'#f4f6f8',muted:'#afb6bd',track:'#3b4249',contrastBase:'#111417'},
  royal:{text:'#fff4d1',muted:'#cab88b',track:'#584373',contrastBase:'#1b102b'},
};

export function providerPresentationSemanticTokens(identity:ProviderPresentationIdentity):ProviderPresentationSemanticTokens|undefined {
  const base=PROVIDER_PRESENTATION_IDENTITY_TOKENS[identity].contrastBase;
  if(!base)return undefined;
  return relativeLuminance(base)>.5?LIGHT_PLATE_SEMANTICS:DARK_PLATE_SEMANTICS;
}

function relativeLuminance(hex:string):number {
  const channels=[1,3,5].map(offset=>Number.parseInt(hex.slice(offset,offset+2),16)/255)
    .map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
  return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
}
