import {describe,expect,it} from 'vitest';
import {THEME_CATALOG} from './themeCatalog';
import {PROVIDER_PRESENTATION_IDENTITIES} from './limitPresentation';
import {accessibleMeterFill,contrastRatio,providerMeterFillColor,resolveMeterTrack} from './meterFill';

// The canonical provider brand colors from themeCatalog.ts plus the neutral
// fallback used when a provider has no accent (see UsageWindowList.css).
const PROVIDER_COLORS=['#10a37f','#e0a884','#7aa2f7','#5b8def','#ff8a3d','#4d6bfe','#20b8cd','#9dbdc9'];

describe('meterFill',()=>{
  it('leaves already-legible fills untouched',()=>{
    expect(accessibleMeterFill('#ffffff','#000000')).toBe('#ffffff');
  });
  it('nudges a low-contrast fill until it clears 3:1, without overshooting to a flat neutral',()=>{
    const track='#c0c9cf'; // adaptive light track
    const fixed=accessibleMeterFill('#9dbdc9',track); // ~1.18:1 unfixed
    expect(contrastRatio(fixed,track)).toBeGreaterThanOrEqual(3);
    expect(fixed).not.toBe('#000000');
    expect(fixed).not.toBe('#ffffff');
  });
  it('keeps every provider brand color >=3:1 against every meter track the product actually renders (23 fixed identities + adaptive light/dark)',()=>{
    const tracks=new Map<string,string>([['adaptive-dark',resolveMeterTrack('adaptive')],['adaptive-light','#c0c9cf']]);
    for(const identity of PROVIDER_PRESENTATION_IDENTITIES){
      if(identity==='adaptive')continue;
      tracks.set(identity,resolveMeterTrack(identity));
    }
    for(const [name,track] of tracks){
      for(const color of PROVIDER_COLORS){
        const fill=accessibleMeterFill(color,track);
        expect(contrastRatio(fill,track),`${name} vs ${color}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
  it('adaptive track follows the structure theme\'s light/dark meter color for every theme',()=>{
    for(const theme of THEME_CATALOG){
      const expected=theme.material?.light?'#c0c9cf':'#38424b';
      expect(resolveMeterTrack('adaptive',theme),theme.slug).toBe(expected);
    }
  });
  it('providerMeterFillColor composes track resolution and the contrast fix',()=>{
    const lightTheme=THEME_CATALOG.find(theme=>theme.material?.light)!;
    const darkTheme=THEME_CATALOG.find(theme=>!theme.material?.light)!;
    expect(contrastRatio(providerMeterFillColor('#4d6bfe','adaptive',lightTheme),'#c0c9cf')).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(providerMeterFillColor('#4d6bfe','adaptive',darkTheme),'#38424b')).toBeGreaterThanOrEqual(3);
  });
});
