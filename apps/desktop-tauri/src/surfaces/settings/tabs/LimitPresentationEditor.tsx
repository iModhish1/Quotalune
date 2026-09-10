import {DEFAULT_LIMIT_PRESENTATION,PROVIDER_PRESENTATION_IDENTITIES,type LimitPresentation,type ProviderPresentationIdentity} from '../../../design-system/limitPresentation';
import {useId} from 'react';
import {useLocale} from '../../../hooks/useLocale';
import {Select} from '../../../components/FormControls';
import './LimitPresentationEditor.css';
export default function LimitPresentationEditor({provider,value=DEFAULT_LIMIT_PRESENTATION,disabled,customized=false,onChange,onReset}:{provider:string;value?:LimitPresentation;disabled:boolean;customized?:boolean;onChange:(value:LimitPresentation)=>void;onReset?:()=>void}){
  const group=useId();
  const {t}=useLocale();
  const shapes=[{shape:'horizontal',label:t('HorizontalBar')},{shape:'vertical',label:t('VerticalBar')},{shape:'ring',label:t('CircularRing')}] as const;
  const identityLabels:Record<ProviderPresentationIdentity,string>={
    adaptive:'Adaptive',precision:'Precision',glass:'Glass',pearl:'Pearl',prism:'Prism',mono:'Mono',signal:'Signal',luxe:'Luxe',
    frost:'Frost',ember:'Ember',jade:'Jade',rose:'Rose',cobalt:'Cobalt',bronze:'Bronze',paper:'Paper',ultraviolet:'Ultraviolet',
    midnight:'Midnight Glass',aerogel:'Mint Aerogel',porcelain:'Cobalt Porcelain',champagne:'Champagne Glass',
    terracotta:'Terracotta Halo',cyberlime:'Cyber Lime',graphite:'Graphite Studio',royal:'Royal Amethyst',
  };
  return <fieldset className="limit-choice-editor" disabled={disabled}>
    <legend>{t('IndicatorAppearance')}</legend>
    <fieldset className="provider-identity-picker"><legend>{t('ProviderPresentationIdentity')}</legend><p>{t('ProviderPresentationIdentityHelper')}</p><div>
      {PROVIDER_PRESENTATION_IDENTITIES.map(identity=><label key={identity} data-selected={(value.identity??'adaptive')===identity} data-identity={identity}>
        <input type="radio" name={`${group}-identity`} aria-label={`${identityLabels[identity]} identity for ${provider}`} checked={(value.identity??'adaptive')===identity} onChange={()=>onChange({...value,identity})}/>
        <span aria-hidden="true"><i/><b>73%</b></span><strong>{identityLabels[identity]}</strong>
      </label>)}
    </div></fieldset>
    <fieldset className="limit-shape-picker"><legend>{t('IndicatorShape')}</legend><div>
      {shapes.map(({shape,label})=><label key={shape} className="limit-shape-option" data-selected={value.shape===shape}>
        <input type="radio" name={group} aria-label={`${label} ${t('ForProvider')} ${provider}`} checked={value.shape===shape} onChange={()=>onChange({...value,shape})}/>
        <svg viewBox="0 0 80 40" aria-hidden="true" focusable="false">
          {shape==='ring'?<><circle className="limit-shape-track" cx="40" cy="20" r="14"/><circle className="limit-shape-fill" cx="40" cy="20" r="14" pathLength="100" strokeDasharray="65 100" transform="rotate(-90 40 20)"/></>:shape==='horizontal'?<><path className="limit-shape-track" d="M12 20H68"/><path className="limit-shape-fill" d="M12 20H48"/></>:<><path className="limit-shape-track" d="M40 6V34"/><path className="limit-shape-fill" d="M40 34V16"/></>}
        </svg><span>{label}</span>
      </label>)}
    </div><small>{t('IndicatorPreviewHelper')}</small></fieldset>
    <label>{t('IndicatorContent')}<Select ariaLabel={`${t('LimitContentAria')} ${provider}`} disabled={disabled} value={value.content} onChange={v=>onChange({...value,content:v as LimitPresentation['content']})} options={[
      {value:'both',label:t('BarAndPercentage')},{value:'bar',label:t('BarOnly')},{value:'value',label:t('PercentageOnly')},
    ]}/></label>
    <label>{t('FillDirection')}<Select disabled={disabled||value.content==='value'} ariaLabel={`${t('LimitDirectionAria')} ${provider}`} value={value.direction} onChange={v=>onChange({...value,direction:v as LimitPresentation['direction']})} options={[
      {value:'forward',label:value.shape==='ring'?t('Clockwise'):value.shape==='vertical'?t('BottomToTop'):t('LeftToRight')},
      {value:'reverse',label:value.shape==='ring'?t('Counterclockwise'):value.shape==='vertical'?t('TopToBottom'):t('RightToLeft')},
    ]}/></label>
    {value.content==='value'&&<small>{t('PercentageOnlyHelper')}</small>}
    <small>{t('LimitPagingHelper')}</small>
    {customized&&onReset&&<button className="limit-choice-editor__reset" type="button" onClick={onReset}>{t('UseGlobalPresentation')}</button>}
  </fieldset>;
}
