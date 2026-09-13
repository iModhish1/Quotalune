import {expect,it} from 'vitest';
import {profileCopyName,reorderedProfileIds} from './profilePresentation';
import type {ProfileDto} from './profileBridge';
const profiles=(names:string[])=>names.map((name,i)=>({id:String(i),name}) as ProfileDto);
it('chooses distinct copy names without modifying the source name',()=>{
 expect(profileCopyName(profiles(['Work','Work copy','WORK COPY 2']),'Work','copy')).toBe('Work copy 3');
 expect(profileCopyName(profiles(['عمل','عمل نسخة']),'عمل','نسخة')).toBe('عمل نسخة 2');
});
it('preserves identities and boundaries for profile order',()=>{
 const source=profiles(['First','Second','Third']);
 expect(reorderedProfileIds(source,'1',-1)).toEqual(['1','0','2']);
 expect(reorderedProfileIds(source,'0',-1)).toEqual(['0','1','2']);
 expect(reorderedProfileIds(source,'missing',1)).toEqual(['0','1','2']);
 expect(source.map(p=>p.id)).toEqual(['0','1','2']);
});
