export interface Collection {id:string;items:string[]}
export interface ItemFields {name:boolean;value:boolean;reset:boolean}
export type CollectionView="horizontal"|"vertical"|"grid";
export const DEFAULT_FIELDS:ItemFields={name:false,value:true,reset:false};
export function detachItem(groups:Collection[],item:string,newId:string):Collection[]{
  if(!groups.some(g=>g.items.includes(item)) || groups.some(g=>g.id===newId))return groups;
  return [...groups.map(g=>({...g,items:g.items.filter(id=>id!==item)})).filter(g=>g.items.length),{id:newId,items:[item]}];
}
export function mergeItem(groups:Collection[],item:string,target:string,index?:number):Collection[]{
  if(!groups.some(g=>g.items.includes(item)) || !groups.some(g=>g.id===target))return groups;
  return groups.map(g=>{
    const items=g.items.filter(id=>id!==item);
    if(g.id===target)items.splice(Math.max(0,Math.min(index??items.length,items.length)),0,item);
    return {...g,items};
  }).filter(g=>g.items.length);
}
export function moveItem(groups:Collection[],item:string,delta:number):Collection[]{
  const group=groups.find(g=>g.items.includes(item));if(!group)return groups;
  const from=group.items.indexOf(item),to=Math.max(0,Math.min(group.items.length-1,from+delta));
  return mergeItem(groups,item,group.id,to);
}
/** Logical design dimensions; DOM and native-window proof remain separate. */
export function collectionLayout(items:string[],fields:Record<string,ItemFields>,view:CollectionView,scale:number){
  const visible=items.slice(0,3),count=visible.length;
  const columns=view==="vertical"?1:view==="grid"?Math.min(2,count):count;
  const rows=count?Math.ceil(count/columns):0;
  const cellWidth=Math.max(48,...visible.map(id=>(fields[id]??DEFAULT_FIELDS).name || (fields[id]??DEFAULT_FIELDS).reset?96:48));
  const cellHeight=Math.max(40,...visible.map(id=>{const f=fields[id]??DEFAULT_FIELDS;return 40+Number(f.name)*18+Number(f.value)*18+Number(f.reset)*18;}));
  const padding=count>1?8:0,gap=6;
  const factor=Math.max(.75,Math.min(1.25,Number.isFinite(scale)?scale/100:1));
  return {width:count?(columns*cellWidth+(columns-1)*gap+padding*2)*factor:0,
    height:count?(rows*cellHeight+(rows-1)*gap+padding*2)*factor:0,
    columns,cellWidth,cellHeight,padding,gap,factor};
}
