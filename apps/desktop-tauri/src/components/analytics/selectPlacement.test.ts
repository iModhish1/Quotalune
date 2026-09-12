import {describe,it,expect} from "vitest";
import {selectPlacement} from "./selectPlacement";
describe("select placement",()=>{
 const rect={left:450,right:570,top:610,bottom:646,width:120};
 it("anchors a short menu directly above its trigger instead of reserving 320 pixels",()=>{
  const p=selectPlacement(rect,132,{width:1280,height:700});
  expect(p.top+132).toBe(rect.top-5);
 });
 it("uses scrolling for a tall menu and stays inside the viewport",()=>{
  const p=selectPlacement({...rect,top:180,bottom:216},700,{width:600,height:400});
  expect(p.top).toBe(221);expect(p.maxHeight).toBe(171);expect(p.left+p.width).toBeLessThanOrEqual(592);
 });
 it("aligns RTL menus to the trigger's right edge",()=>{
  const p=selectPlacement(rect,100,{width:1280,height:900},true);expect(p.left+p.width).toBe(rect.right);expect(p.top).toBe(651);
 });
});
