import {expect,it,vi} from 'vitest';
import {LatestWriteQueue} from './latestWriteQueue';

it('serializes rapid navigation and retains independent badge/order edits',async()=>{
 let release!:()=>void;
 const first=new Promise<void>(resolve=>{release=resolve;});
 const write=vi.fn().mockReturnValueOnce(first).mockResolvedValue(undefined);
 const queue=new LatestWriteQueue({anchor:'a',badge:'top-right',order:['a','b']},write);
 const done=queue.push({anchor:'b'});
 await Promise.resolve();
 queue.push({badge:'bottom-left'});
 queue.push({anchor:'a',order:['b','a']});
 queue.synchronize({anchor:'stale',badge:'stale',order:[]});
 expect(write).toHaveBeenCalledTimes(1);
 release();await done;
 expect(write).toHaveBeenCalledTimes(2);
 expect(write).toHaveBeenLastCalledWith({anchor:'a',badge:'bottom-left',order:['b','a']});
});

it('writes the last gesture at every completion microtask boundary',async()=>{
 for(let boundary=0;boundary<6;boundary++) {
  let release!:()=>void;
  const first=new Promise<void>(resolve=>{release=resolve;});
  const write=vi.fn().mockReturnValueOnce(first).mockResolvedValue(undefined);
  const queue=new LatestWriteQueue({anchor:'a'},write);
  const one=queue.push({anchor:'b'});await Promise.resolve();release();
  for(let i=0;i<boundary;i++)await Promise.resolve();
  const two=queue.push({anchor:'c'});await Promise.all([one,two]);
  expect(write).toHaveBeenLastCalledWith({anchor:'c'});
 }
});
