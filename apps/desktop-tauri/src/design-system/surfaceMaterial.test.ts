import { describe, expect, it } from "vitest";
import { CANONICAL_THEME, THEME_CATALOG, providerColor } from "./themeCatalog";
import { surfaceMaterialStyle } from "./surfaceMaterial";

function luminance(hex:string){
  const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
}
describe("portable surface materials",()=>{
  it('carries a distinct non-palette identity for every theme',()=>{
    const identities=THEME_CATALOG.map(theme=>theme.identity);
    expect(new Set(identities.map(identity=>JSON.stringify(identity))).size).toBe(THEME_CATALOG.length);
    expect(new Set(identities.map(identity=>identity!.signature)).size).toBe(THEME_CATALOG.length);
    for(const theme of THEME_CATALOG){
      const style=surfaceMaterialStyle(theme) as Record<string,string>;
      expect(theme.identity!.signature.trim()).not.toBe("");
      expect(style['--surface-detail-radius']).toBe(`${theme.identity!.detailRadius}px`);
      expect(style['--surface-relief']).toBe(theme.identity!.relief);
      expect(style['--surface-rim-size']).toBe(String(theme.identity!.rimSize));
      expect(style['--surface-icon-radius']).toBe(theme.identity!.iconRadius);
      expect(style['--surface-label-tracking']).toBe(theme.identity!.labelTracking);
      expect(style['--surface-ornament']).toBe(theme.identity!.ornament);
      expect(style['--surface-accent-halo']).toBe(theme.identity!.accentHalo);
      expect(style['--surface-inlay']).toBe(theme.identity!.inlay);
      expect(style['--surface-meter-cap']).toBe(theme.identity!.meterCap);
      expect(style['--surface-connector']).toBe(theme.identity!.connector);
      expect(style['--surface-mark-filter']).toBe(theme.identity!.markFilter);
      expect(style['--surface-mark-frame']).toBe(theme.identity!.markFrame);
      expect(style['--surface-mark-border']).toBe(theme.identity!.markBorder);
      expect(style['--surface-mark-blend']).toBe(theme.identity!.markBlend);
      expect(theme.identity!.detailRadius).toBeGreaterThanOrEqual(12);
      expect(theme.identity!.detailRadius).toBeLessThanOrEqual(28);
    }
    expect(new Set(THEME_CATALOG.map(theme=>theme.identity!.markFrame)).size).toBe(THEME_CATALOG.length);
    expect(new Set(THEME_CATALOG.map(theme=>theme.identity!.markBorder)).size).toBe(THEME_CATALOG.length);
  });
  it.each(THEME_CATALOG)("$name emits paint only and readable foregrounds",theme=>{
    const style=surfaceMaterialStyle(theme) as Record<string,string>;
    expect(Object.keys(style).every(key=>key.startsWith("--surface-"))).toBe(true);
    expect(JSON.stringify(style)).not.toMatch(/width|height|padding|transform|animation|blur\(/);
    for(const text of [style["--surface-text"],style["--surface-muted"]]){
      for(const bg of [theme.core,...theme.bg]){
        const a=luminance(text),b=luminance(bg);
        expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it("new reference materials keep provider identity independent of the finish",()=>{
    for(const theme of THEME_CATALOG.filter(t=>t.material)){
      for(const provider of ["codex","claude","gemini"])
        expect(providerColor(theme,provider)).toBe(providerColor(CANONICAL_THEME,provider));
    }
    expect(new Set(THEME_CATALOG.filter(t=>t.material).map(t=>t.material!.finish)).size).toBe(THEME_CATALOG.filter(t=>t.material).length);
  });
  it("never emits a provider-icon recoloring token for any theme (Wave 6 Phase 4 bleed fix)",()=>{
    // surfaceMaterial.ts used to emit --surface-icon-filter/--surface-provider-filter,
    // consumed by surfaceMaterial.css to grayscale + overexpose every provider icon
    // inside the Notch/Reel/Flow-Surface hosts, and NotchSurface.css separately
    // overwrote --provider-brand with a hardcoded white — a confirmed structure-to-
    // provider-identity bleed (docs/validation/VISUAL_THEME_OWNERSHIP.md). Regression
    // guard: no theme's emitted surface style should reintroduce icon-level color
    // manipulation, whatever token name a future change might use.
    for(const theme of THEME_CATALOG){
      const style=surfaceMaterialStyle(theme) as Record<string,string>;
      expect(style["--surface-icon-filter"]).toBeUndefined();
      expect(style["--surface-provider-filter"]).toBeUndefined();
      // --surface-icon-radius is legitimate (geometry, not color) — only
      // filter/recolor-shaped keys targeting icons/providers are banned.
      expect(Object.keys(style).some(key=>/provider/i.test(key) || /icon.*filter/i.test(key))).toBe(false);
    }
  });
});
