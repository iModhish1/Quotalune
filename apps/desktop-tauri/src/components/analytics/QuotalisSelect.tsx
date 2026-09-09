import {useEffect,useId,useLayoutEffect,useRef,useState,type CSSProperties,type KeyboardEvent} from "react";
import {createPortal} from "react-dom";
import {ProviderIcon} from "../providers/ProviderIcon";
import "./QuotalisSelect.css";
export interface QuotalisOption {value:string;label:string;providerId?:string;}
export default function QuotalisSelect({label,value,options,onChange,searchable=false}: {
 label:string;value:string;options:QuotalisOption[];onChange:(value:string)=>void;searchable?:boolean;
}) {
 const id=useId(),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null);
 const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[active,setActive]=useState(0),[position,setPosition]=useState<CSSProperties>({});
 const filtered=options.filter(option=>option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const close=(restore=false)=>{setOpen(false);setQuery("");if(restore)trigger.current?.focus();};
 const choose=(option:QuotalisOption)=>{onChange(option.value);close(true);};
 useLayoutEffect(()=>{
  if(!open||!trigger.current)return;
  const place=()=>{const rect=trigger.current!.getBoundingClientRect(),style=getComputedStyle(trigger.current!);
   const width=Math.min(Math.max(220,rect.width),innerWidth-16),height=Math.min(320,innerHeight-24);
   const top=innerHeight-rect.bottom>=Math.min(height,180)?rect.bottom+5:Math.max(8,rect.top-height-5);
   setPosition({left:Math.max(8,Math.min(style.direction==="rtl"?rect.right-width:rect.left,innerWidth-width-8)),top,width,maxHeight:Math.min(height,innerHeight-top-8),direction:style.direction as "rtl"|"ltr",
    "--select-bg":style.getPropertyValue("--qa-analytics-surface-opaque")||"#061426","--select-text":style.getPropertyValue("--qa-analytics-text-primary")||"#edf5ff","--select-accent":style.getPropertyValue("--qa-analytics-accent")||"#59baff"} as CSSProperties);};
  place();window.addEventListener("resize",place);window.addEventListener("scroll",place,true);
  return()=>{window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true);};
 },[open]);
 useEffect(()=>{if(!open)return;(searchable?input.current:panel.current)?.focus();
  const outside=(event:PointerEvent)=>{if(!panel.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))close();};
  document.addEventListener("pointerdown",outside);return()=>document.removeEventListener("pointerdown",outside);
 },[open,searchable]);
 useEffect(()=>{panel.current?.querySelector('[data-active="true"]')?.scrollIntoView?.({block:"nearest"});},[active]);
 const key=(event:KeyboardEvent)=>{
  if(event.key==="Escape"){event.preventDefault();event.stopPropagation();close(true);}
  else if(event.key==="Tab")close(true);
  else if(["ArrowDown","ArrowUp","Home","End"].includes(event.key)){event.preventDefault();setActive(index=>event.key==="Home"?0:event.key==="End"?Math.max(0,filtered.length-1):(index+(event.key==="ArrowDown"?1:-1)+filtered.length)%Math.max(1,filtered.length));}
  else if(event.key==="Enter"||(!searchable&&event.key===" ")){event.preventDefault();if(filtered[active])choose(filtered[active]);}
  else if(!searchable&&event.key.length===1){const index=filtered.findIndex(option=>option.label.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));if(index>=0)setActive(index);}
 };
 const show=()=>{setActive(Math.max(0,options.findIndex(option=>option.value===value)));setOpen(true);};
 return <><button className="quotalis-select" type="button" ref={trigger} aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?id:undefined}
  onClick={()=>open?close():show()} onKeyDown={event=>{if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();show();}}}>
   <span>{options.find(option=>option.value===value)?.label??label}</span><span aria-hidden="true">⌄</span></button>
  {open&&createPortal(<div className="quotalis-select-panel" ref={panel} style={position} tabIndex={-1} onKeyDown={key} role={searchable?undefined:"combobox"} aria-label={searchable?undefined:label} aria-expanded={searchable?undefined:true} aria-controls={searchable?undefined:id} aria-activedescendant={!searchable&&filtered[active]?`${id}-${active}`:undefined}
   onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node)&&event.relatedTarget!==trigger.current)close();}}>
   {searchable&&<input ref={input} type="search" role="combobox" placeholder={label} aria-label={label} aria-autocomplete="list" aria-expanded="true" aria-controls={id} aria-activedescendant={filtered[active]?`${id}-${active}`:undefined} value={query} onChange={event=>{setQuery(event.target.value);setActive(0);}}/>}
   <div id={id} role="listbox" aria-label={label}>{filtered.map((option,index)=><button type="button" role="option" id={`${id}-${index}`} key={option.value} aria-selected={value===option.value} tabIndex={-1} data-active={index===active}
    onPointerMove={()=>setActive(index)} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(option)}>
    {option.providerId&&<ProviderIcon providerId={option.providerId} size={18}/>}<span>{option.label}</span><span aria-hidden="true">{value===option.value?"✓":""}</span></button>)}</div>
  </div>,document.body)}</>;
}
