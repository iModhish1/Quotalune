import './LimitChoiceEditor.css';
import {useLocale} from '../../../hooks/useLocale';

interface Props {
  provider: string;
  choices: {id: string; label: string}[];
  selected: readonly string[];
  disabled: boolean;
  customized?: boolean;
  onChange: (ids: string[]) => void;
  onReset?: () => void;
}

export default function LimitChoiceEditor({provider,choices,selected,disabled,customized=false,onChange,onReset}: Props) {
  const {t}=useLocale();
  const ids=[...new Set([...selected,...choices.map(choice=>choice.id)])];
  const move=(id:string,offset:number)=>{
    const next=[...selected];
    const index=next.indexOf(id), target=index+offset;
    if(index<0 || target<0 || target>=next.length)return;
    [next[index],next[target]]=[next[target],next[index]];
    onChange(next);
  };
  return <fieldset className="limit-choice-editor" disabled={disabled}>
    <legend>{t('LimitsShown')}</legend>
    <small>{t('LimitsShownHelper')}</small>
    {customized && onReset && <button className="limit-choice-editor__reset" type="button" onClick={onReset}>
      {t('UseProviderLimitDefaults')}
    </button>}
    {ids.length===0 && <p>{t('NoLimitsReported')}</p>}
    <ul>{ids.map(id=>{
      const label=choices.find(choice=>choice.id===id)?.label ?? `${t('Unavailable')} · ${id}`;
      const index=selected.indexOf(id);
      return <li key={id} data-selected={index>=0}>
        <label><input type="checkbox" checked={index>=0} aria-label={`${t('ShowLimit')} ${label} ${t('ForProvider')} ${provider}`}
          onChange={event=>onChange(event.target.checked?[...selected,id]:selected.filter(value=>value!==id))}/>
          <span className="limit-choice-editor__label">{label}</span></label>
        {index>=0 && <span className="limit-choice-editor__order">
          <span aria-label={`${t('LimitPosition')} ${index+1}`}>{index+1}</span>
          <button type="button" disabled={index===0} aria-label={`${t('MoveLimitEarlier')} ${label} ${t('ForProvider')} ${provider}`} onClick={()=>move(id,-1)}>↑</button>
          <button type="button" disabled={index===selected.length-1} aria-label={`${t('MoveLimitLater')} ${label} ${t('ForProvider')} ${provider}`} onClick={()=>move(id,1)}>↓</button>
        </span>}
      </li>;
    })}</ul>
  </fieldset>;
}
