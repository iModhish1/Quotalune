import { useSyncExternalStore } from 'react';
import officialMark from '../assets/quotaarc-void-mark.svg';
import orbitGlyph from '../assets/quotaarc-orbit-glyph.svg';
import { logoScale, readLogoAppearance, subscribeLogoAppearance, type LogoSize, type LogoVariant } from '../design-system/logoAppearance';
import './QuotaArcMark.css';

/** Same silver master asset used by About. Decorative inside named controls. */
export default function QuotaArcMark({size=24,className,label,variant,sizePreference}:{size?:number;className?:string;label?:string;variant?:LogoVariant;sizePreference?:LogoSize}) {
  const appearance = useSyncExternalStore(subscribeLogoAppearance, readLogoAppearance, readLogoAppearance);
  const renderedSize = Math.round(size * logoScale(sizePreference ?? appearance.size));
  return <span
    data-logo-variant={variant ?? appearance.variant}
    className={['quotaarc-mark',className].filter(Boolean).join(' ')}
    style={{
      width: renderedSize,
      height: renderedSize,
    }}
  >
    <img className="quotaarc-mark__master" src={officialMark} data-quotaarc-mark="official" alt={label ?? ""} aria-hidden={label ? undefined : true}
      draggable={false} width={renderedSize} height={renderedSize}/>
    <img className="quotaarc-mark__glyph" src={orbitGlyph} alt="" aria-hidden="true" draggable={false}/>
  </span>;
}
