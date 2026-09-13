import {useEffect,useId,useLayoutEffect,useRef,useState,type CSSProperties,type KeyboardEvent} from "react";
import {createPortal} from "react-dom";
import {useOptionalLocale} from "../../hooks/useLocale";
import {ProviderIcon} from "../providers/ProviderIcon";
import "./QuotalisSelect.css";
import {selectPlacement} from "./selectPlacement";
export interface QuotalisOption {value:string;label:string;providerId?:string;description?:string;group?:string;disabled?:boolean;}
export default function QuotalisSelect({label,value,options,onChange,searchable=false,disabled=false,multiple,onMultipleChange,minSelected=0}: {
 label:string;value:string;options:QuotalisOption[];onChange:(value:string)=>void;searchable?:boolean;disabled?:boolean;multiple?:string[];onMultipleChange?:(values:string[])=>void;minSelected?:number;
}) {
 const locale=useOptionalLocale();
 const t=(key:"V3SelectAll"|"V3Clear")=>locale?.t(key)??(key==="V3SelectAll"?"Select all":"Clear");
 const id=useId(),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null);
 const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[active,setActive]=useState(0),[position,setPosition]=useState<CSSProperties>({});
 const filtered=options.filter(option=>option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const close=(restore=false)=>{setOpen(false);setQuery("");if(restore)trigger.current?.focus();};
 const choose=(option:QuotalisOption)=>{if(option.disabled)return;if(multiple){const next=multiple.includes(option.value)?multiple.filter(v=>v!==option.value):[...multiple,option.value];if(next.length>=minSelected)onMultipleChange?.(next);}else{onChange(option.value);close(true);}};
 useLayoutEffect(()=>{
  if(!open||!trigger.current)return;
  const place=()=>{const rect=trigger.current!.getBoundingClientRect(),style=getComputedStyle(trigger.current!);
   if(rect.bottom<0||rect.top>innerHeight){close();return;}
   setPosition({...selectPlacement(rect,(panel.current?.scrollHeight??0)+2,{width:innerWidth,height:innerHeight},style.direction==="rtl"),direction:style.direction as "rtl"|"ltr",
    "--select-bg":style.getPropertyValue("--qa-analytics-surface-opaque")||style.getPropertyValue("--qa-core")||"#101923","--select-text":style.getPropertyValue("--qa-analytics-text-primary")||style.getPropertyValue("--qa-ink-primary")||"#edf5ff","--select-accent":style.getPropertyValue("--qa-analytics-accent")||style.getPropertyValue("--qa-accent")||"#59baff"} as CSSProperties);};
  place();window.addEventListener("resize",place);window.addEventListener("scroll",place,true);
  const observer=typeof ResizeObserver==="undefined"?null:new ResizeObserver(place);
  if(panel.current)observer?.observe(panel.current);
  return()=>{observer?.disconnect();window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true);};
 },[open,query]);
 useEffect(()=>{if(disabled)close();},[disabled]);
 useEffect(()=>{if(!open)return;(searchable?input.current:panel.current)?.focus();
  const outside=(event:PointerEvent)=>{if(!panel.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))close();};
  document.addEventListener("pointerdown",outside);return()=>document.removeEventListener("pointerdown",outside);
 },[open,searchable]);
 useEffect(()=>{panel.current?.querySelector('[data-active="true"]')?.scrollIntoView?.({block:"nearest"});},[active]);
 const key=(event:KeyboardEvent)=>{
  if(event.key==="Escape"){event.preventDefault();event.stopPropagation();close(true);}
  else if(event.key==="Tab")close(true);
  else if(["ArrowDown","ArrowUp","Home","End"].includes(event.key)){event.preventDefault();setActive(index=>{const eligible=filtered.map((o,i)=>o.disabled?-1:i).filter(i=>i>=0);if(!eligible.length)return 0;if(event.key==="Home")return eligible[0];if(event.key==="End")return eligible[eligible.length-1];return event.key==="ArrowDown"?(eligible.find(i=>i>index)??eligible[0]):([...eligible].reverse().find(i=>i<index)??eligible[eligible.length-1]);});}
  else if(event.key==="Enter"||(!searchable&&event.key===" ")){event.preventDefault();if(filtered[active])choose(filtered[active]);}
  else if(!searchable&&event.key.length===1){const index=filtered.findIndex(option=>option.label.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));if(index>=0)setActive(index);}
 };
 const show=()=>{if(disabled)return;setActive(Math.max(0,options.findIndex(option=>option.value===value)));setOpen(true);};
 return <><button className="quotalis-select" type="button" disabled={disabled} ref={trigger} aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?id:undefined}
  onClick={()=>open?close():show()} onKeyDown={event=>{if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();show();}}}>
   <span>{multiple?`${label} · ${multiple.length}`:options.find(option=>option.value===value)?.label??label}</span><span aria-hidden="true">⌄</span></button>
  {open&&createPortal(<div className="quotalis-select-panel" ref={panel} style={position} tabIndex={-1} onKeyDown={key} role={searchable?undefined:"combobox"} aria-label={searchable?undefined:label} aria-expanded={searchable?undefined:true} aria-controls={searchable?undefined:id} aria-activedescendant={!searchable&&filtered[active]?`${id}-${active}`:undefined}
   onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node)&&event.relatedTarget!==trigger.current)close();}}>
   {searchable&&<input ref={input} type="search" role="combobox" placeholder={label} aria-label={label} aria-autocomplete="list" aria-expanded="true" aria-controls={id} aria-activedescendant={filtered[active]?`${id}-${active}`:undefined} value={query} onChange={event=>{setQuery(event.target.value);setActive(0);}}/>}
   {multiple&&<div className="quotalis-select-bulk"><button type="button" onClick={()=>onMultipleChange?.(options.filter(o=>!o.disabled||multiple.includes(o.value)).map(o=>o.value))}>{t("V3SelectAll")}</button><button type="button" disabled={minSelected>0} onClick={()=>onMultipleChange?.(multiple.filter(v=>options.some(o=>o.value===v&&o.disabled)))}>{t("V3Clear")}</button></div>}
   <div id={id} role="listbox" aria-multiselectable={multiple?true:undefined} aria-label={label}>{filtered.map((option,index)=><button type="button" role="option" id={`${id}-${index}`} key={option.value} aria-selected={multiple?multiple.includes(option.value):value===option.value} aria-disabled={option.disabled} tabIndex={-1} data-active={index===active}
    onPointerMove={()=>setActive(index)} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(option)}>
    {option.providerId&&<ProviderIcon providerId={option.providerId} size={18}/>}<span>{option.group&&<small className="quotalis-select-group">{option.group}</small>}{option.label}{option.description&&<small className="quotalis-select-description">{option.description}</small>}</span><span className="quotalis-select-indicator" data-selected={multiple?multiple.includes(option.value):value===option.value} aria-hidden="true"/></button>)}</div>
  </div>,trigger.current?.closest("dialog")??document.body)}</>;
}
