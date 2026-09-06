import {render} from '@testing-library/react';
import {describe,expect,it} from 'vitest';

import {PROVIDER_PRESENTATION_IDENTITIES} from '../../design-system/limitPresentation';
import {surfaceMaterialStyle} from '../../design-system/surfaceMaterial';
import {THEME_CATALOG} from '../../design-system/themeCatalog';
import UsageWindowList from './UsageWindowList';
import type {StageUsageWindow} from './stageTypes';
import {PROVIDER_PRESENTATION_IDENTITY_TOKENS,providerPresentationSemanticTokens} from '../../design-system/providerPresentationIdentity';

const windows:StageUsageWindow[]=[
  {id:'five-hour',label:'5-hour',primaryValue:73,primaryLabel:'remaining',arcFraction:.73,reset:'3h 42m',resetsAt:null},
  {id:'weekly',label:'Weekly',primaryValue:41,primaryLabel:'remaining',arcFraction:.41,reset:'4d 9h',resetsAt:null},
];

describe('provider identity and structure-theme compatibility matrix',()=>{
  it('keeps both limit values, labels, meters and identity hooks intact across every pairing',()=>{
    for(const theme of THEME_CATALOG){
      for(const identity of PROVIDER_PRESENTATION_IDENTITIES){
        const key=`${theme.slug}/${identity}`;
        const {container,unmount}=render(<div className="flow-surface" style={surfaceMaterialStyle(theme)}>
          <UsageWindowList providerId="codex" windows={windows} presentation={{shape:'ring',content:'both',direction:'forward',identity}}/>
        </div>);
        const list=container.querySelector('.quota-window-list');
        expect(list,key).toHaveAttribute('data-provider-identity',identity);
        expect(list,key).toHaveTextContent('73% remaining');
        expect(list,key).toHaveTextContent('41% remaining');
        expect(container.querySelectorAll('[role=meter]'),key).toHaveLength(2);
        expect([...container.querySelectorAll('[role=meter]')].map(node=>node.getAttribute('aria-valuenow')),key).toEqual(['73','41']);
        expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--surface-text'),key).toBe(theme.material!.text);
        unmount();
      }
    }
  });
  it('gives every non-adaptive identity a self-contained AA contrast plate',()=>{
    for(const identity of PROVIDER_PRESENTATION_IDENTITIES.filter(value=>value!=='adaptive')){
      const tokens=PROVIDER_PRESENTATION_IDENTITY_TOKENS[identity];
      expect(tokens.contrastBase,identity).toBeTruthy();
      expect(contrast(tokens.text!,tokens.contrastBase!),`${identity} primary`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens.muted!,tokens.contrastBase!),`${identity} secondary`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('keeps warning, critical and exhausted values AA-legible on every fixed identity plate',()=>{
    for(const identity of PROVIDER_PRESENTATION_IDENTITIES.filter(value=>value!=='adaptive')){
      const base=PROVIDER_PRESENTATION_IDENTITY_TOKENS[identity].contrastBase!;
      const semantics=providerPresentationSemanticTokens(identity)!;
      for(const [tone,color] of Object.entries(semantics)){
        expect(contrast(color,base),`${identity} ${tone}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(new Set(Object.values(semantics)).size,`${identity} distinct semantic tones`).toBe(3);
    }
  });
  it('keeps the adaptive identity\'s primary and muted/reset-label text AA-legible on every structure theme',()=>{
    // Mirrors surfaceMaterialStyle: adaptive's --pi-text/--pi-muted fall back to
    // --surface-text/--surface-muted, rendered on --surface-raised (theme.bg[0]).
    for(const theme of THEME_CATALOG){
      const text=theme.material?.text??'#eef4f8';
      const muted=theme.material?.muted??'#b1bcc7';
      const bg=theme.bg[0];
      expect(contrast(text,bg),`${theme.slug} adaptive primary text`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(muted,bg),`${theme.slug} adaptive muted/reset-label text`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('keeps the adaptive identity\'s warning/critical/exhausted tones AA-legible on every structure theme',()=>{
    // Adaptive has no contrastBase (self-contained plate); its tones fall back to the
    // CSS defaults in UsageWindowList.css: color-mix(in srgb, currentColor 72%, #hex).
    // That mix depends on each theme's own text/background pair, so — unlike the fixed
    // identities above — this is the one identity that genuinely needs a per-theme check.
    const WARNING='#ffd166',CRITICAL='#ff5d73';
    for(const theme of THEME_CATALOG){
      const text=theme.material?.text??'#f0f3f7';
      const bg=theme.bg[0];
      const warningColor=mix(text,WARNING,.72);
      const criticalColor=mix(text,CRITICAL,.72);
      const exhaustedColor=text; // currentColor, unmixed
      expect(contrast(warningColor,bg),`${theme.slug} adaptive warning`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(criticalColor,bg),`${theme.slug} adaptive critical`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(exhaustedColor,bg),`${theme.slug} adaptive exhausted`).toBeGreaterThanOrEqual(4.5);
      expect(new Set([warningColor,criticalColor,exhaustedColor]).size,`${theme.slug} adaptive distinct tones`).toBe(3);
    }
  });
  it('normalizes remaining and used windows into the same visual urgency',()=>{
    const cases=[
      {value:20,label:'remaining',tone:'warning'},
      {value:80,label:'used',tone:'warning'},
      {value:10,label:'remaining',tone:'critical'},
      {value:90,label:'used',tone:'critical'},
      {value:0,label:'remaining',tone:'exhausted'},
      {value:100,label:'used',tone:'exhausted'},
    ] as const;
    for(const test of cases){
      const window:StageUsageWindow={id:`${test.label}-${test.value}`,label:'Limit',primaryValue:test.value,primaryLabel:test.label,arcFraction:test.value/100,reset:'1h',resetsAt:null};
      const {container,unmount}=render(<UsageWindowList windows={[window]} presentation={{shape:'ring',content:'both',direction:'forward',identity:'pearl'}}/>);
      expect(container.querySelector('.quota-window-row')).toHaveAttribute('data-usage-tone',test.tone);
      unmount();
    }
  });
});

function contrast(foreground:string,background:string):number {
  const luminance=(hex:string)=>{
    const channels=[1,3,5].map(offset=>Number.parseInt(hex.slice(offset,offset+2),16)/255)
      .map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
    return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
  };
  const [lighter,darker]=[luminance(foreground),luminance(background)].sort((a,b)=>b-a);
  return (lighter+.05)/(darker+.05);
}

/** Mirrors CSS `color-mix(in srgb, a <pctA>%, b)`: per-channel weighted average in sRGB. */
function mix(hexA:string,hexB:string,pctA:number):string {
  const rgb=(hex:string)=>[1,3,5].map(offset=>Number.parseInt(hex.slice(offset,offset+2),16));
  const [a,b]=[rgb(hexA),rgb(hexB)];
  const out=a.map((value,index)=>Math.round(value*pctA+b[index]*(1-pctA)));
  return '#'+out.map(value=>value.toString(16).padStart(2,'0')).join('');
}
