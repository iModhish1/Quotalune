import { expect,it } from "vitest";
import { placeSurface,snapSurface,SURFACE_POSITIONS } from "./surfacePlacement";
it("places all nine positions inside the work area and round trips docked positions",()=>{
  for(const anchor of SURFACE_POSITIONS){
    const p=placeSurface(anchor,144,152,800,600);
    expect(p.x).toBeGreaterThanOrEqual(0);expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.x+144).toBeLessThanOrEqual(800);expect(p.y+152).toBeLessThanOrEqual(600);
    expect(snapSurface(p.x,p.y,144,152,800,600)).toBe(anchor);
  }
});
it("prioritizes corners over single edges",()=>{
  expect(snapSurface(650,440,144,152,800,600)).toBe("bottom-right");
  expect(snapSurface(10,200,144,152,800,600)).toBe("left");
});
