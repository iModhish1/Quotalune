import type {CatalogTheme} from './themeCatalog';
import type {ProviderPresentationIdentity} from './limitPresentation';
import {PROVIDER_PRESENTATION_IDENTITY_TOKENS} from './providerPresentationIdentity';

/**
 * Provider accent colors are chosen for brand recognition, not for contrast
 * against every meter/arc track they might land on (23 fixed provider-identity
 * tracks, plus the two adaptive light/dark tracks). Left alone, several
 * combinations fall well under WCAG's 3:1 non-text contrast floor — some as
 * low as ~1.1:1, effectively invisible. This module is the single place that
 * resolves a track color and nudges a fill color toward it when needed, so
 * every UsageWindowList consumer gets the same guarantee instead of each
 * call site re-deriving (or forgetting) the fix.
 */

function hexToRgb(hex:string):number[] {
  return [1,3,5].map(offset=>Number.parseInt(hex.slice(offset,offset+2),16));
}

function relativeLuminance(hex:string):number {
  const channels=hexToRgb(hex).map(value=>{
    const normalized=value/255;
    return normalized<=.04045?normalized/12.92:((normalized+.055)/1.055)**2.4;
  });
  return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
}

export function contrastRatio(foreground:string,background:string):number {
  const [lighter,darker]=[relativeLuminance(foreground),relativeLuminance(background)].sort((a,b)=>b-a);
  return (lighter+.05)/(darker+.05);
}

function mixToward(hex:string,target:string,amount:number):string {
  const [from,to]=[hexToRgb(hex),hexToRgb(target)];
  const mixed=from.map((value,index)=>Math.round(value+(to[index]-value)*amount));
  return '#'+mixed.map(value=>value.toString(16).padStart(2,'0')).join('');
}

/** The track a meter/arc fill for `identity` actually renders against. Mirrors
 * the CSS in UsageWindowList.css / UsageWindowIdentityContrast.css exactly:
 * fixed identities carry their own opaque track; `adaptive` inherits the
 * structure theme's `--surface-meter` (light/dark only — never per-theme). */
export function resolveMeterTrack(identity:ProviderPresentationIdentity='adaptive',theme?:CatalogTheme):string {
  if(identity!=='adaptive'){
    const track=PROVIDER_PRESENTATION_IDENTITY_TOKENS[identity].track;
    if(track)return track;
  }
  return theme?.material?.light?'#c0c9cf':'#38424b';
}

/** Returns `color` unchanged when it already clears 3:1 against `track`;
 * otherwise nudges it toward black or white (whichever the track needs) by
 * the minimum amount that reaches 3:1, preserving hue/brand recognition as
 * much as possible instead of collapsing to a generic neutral. */
export function accessibleMeterFill(color:string,track:string):string {
  if(contrastRatio(color,track)>=3)return color;
  const target=relativeLuminance(track)>.5?'#000000':'#ffffff';
  let lo=0,hi=1,best=mixToward(color,target,1);
  for(let i=0;i<24;i++){
    const mid=(lo+hi)/2;
    const candidate=mixToward(color,target,mid);
    if(contrastRatio(candidate,track)>=3){best=candidate;hi=mid;}else{lo=mid;}
  }
  return best;
}

/** Convenience: resolve the track for `identity`/`theme` and adjust `color` against it. */
export function providerMeterFillColor(color:string,identity?:ProviderPresentationIdentity,theme?:CatalogTheme):string {
  return accessibleMeterFill(color,resolveMeterTrack(identity,theme));
}
