import {describe,expect,it} from 'vitest';
import {usageTone} from './usageTone';

describe('usageTone',()=>{
  it.each([
    [80,'used','warning'],[90,'used','critical'],[100,'used','exhausted'],
    [20,'remaining','warning'],[10,'remaining','critical'],[0,'remaining','exhausted'],
    [79,'used','normal'],[21,'remaining','normal'],[null,'remaining','normal'],
  ] as const)('normalizes %s %s to %s',(value,label,tone)=>expect(usageTone(value,label)).toBe(tone));
});
