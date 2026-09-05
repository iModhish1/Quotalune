import {expect,it} from "vitest";
import {detachItem,mergeItem,moveItem,collectionLayout,DEFAULT_FIELDS} from "./collectionModel";
it("detaches without duplicates and removes an empty group",()=>{
  const initial=[{id:"g",items:["a","b"]}];
  const next=detachItem(initial,"a","solo-a");
  expect(next).toEqual([{id:"g",items:["b"]},{id:"solo-a",items:["a"]}]);
  expect(initial[0].items).toEqual(["a","b"]);
  expect(detachItem(next,"b","solo-b")).toEqual([{id:"solo-a",items:["a"]},{id:"solo-b",items:["b"]}]);
});
it("merges into the target once and supports ordering",()=>{
  const groups=[{id:"a",items:["1"]},{id:"b",items:["2","3"]}];
  const merged=mergeItem(groups,"1","b",1);
  expect(merged).toEqual([{id:"b",items:["2","1","3"]}]);
  expect(moveItem(merged,"1",-1)[0].items).toEqual(["1","2","3"]);
  expect(mergeItem(merged,"missing","b")).toEqual(merged);
});
it("limits compact occupancy to three and shrinks with contents",()=>{
  const fields={a:DEFAULT_FIELDS,b:DEFAULT_FIELDS,c:DEFAULT_FIELDS};
  const three=collectionLayout(["a","b","c"],fields,"horizontal",100);
  expect(collectionLayout(["a","b","c","d"],fields,"horizontal",100)).toEqual(three);
  expect(collectionLayout(["a"],fields,"horizontal",100).width).toBeLessThan(three.width);
  expect(collectionLayout([],fields,"grid",100)).toMatchObject({width:0,height:0});
});
it("recomputes dimensions for fields, orientation and scale",()=>{
  const ids=["a","b","c"], fields={a:DEFAULT_FIELDS};
  const base=collectionLayout(ids,fields,"horizontal",100);
  expect(collectionLayout(ids,{a:{...DEFAULT_FIELDS,name:true,reset:true}},"horizontal",100).height).toBeGreaterThan(base.height);
  expect(collectionLayout(ids,fields,"vertical",100).width).toBeLessThan(base.width);
  expect(collectionLayout(ids,fields,"grid",100).columns).toBe(2);
  expect(collectionLayout(ids,fields,"horizontal",125).width).toBeCloseTo(base.width*1.25);
});
