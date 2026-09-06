import QuotaArcMark from '../components/QuotaArcMark';
import {surfaceMaterialStyle} from '../design-system/surfaceMaterial';
import {THEME_CATALOG} from '../design-system/themeCatalog';
import '../surfaces/flow-surface/FlowSurface.css';
import './ThemeMarkProof.css';

/** Actual surface identity context around the official mark, one card per theme. */
export default function ThemeMarkProof(){
  return <main className="theme-mark-proof" data-theme="dark">
    <header><span>QUOTAARC IDENTITY SYSTEM</span><h1>Theme-adaptive official mark</h1><p>The glyph stays official; its frame, rim, blend and relief inherit each surface identity.</p></header>
    <section aria-label="Theme mark matrix">{THEME_CATALOG.map(theme=><article key={theme.slug} className="theme-mark-proof__card flow-surface" style={surfaceMaterialStyle(theme)} data-theme-mark={theme.slug}>
      <div className="theme-mark-proof__surface"><span className="flow-surface__brand"><QuotaArcMark size={42} variant="silver" sizePreference="balanced" label={`${theme.name} QuotaArc mark`}/></span><i aria-hidden="true"/></div>
      <div><strong>{theme.name}</strong><small>{theme.identity?.signature}</small></div>
    </article>)}</section>
  </main>;
}
