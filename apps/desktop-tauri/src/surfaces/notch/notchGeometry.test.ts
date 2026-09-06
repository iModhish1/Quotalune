import { describe, expect, it } from "vitest";
import { NOTCH_FORMS, notchLayout, notchNodes, notchRotates, rotateNotchNode, providerAccent } from "./notchGeometry";

describe("compact notch family", () => {
  it("turns edge-native silhouettes across axes without rotating their labels",()=>{
    const side=notchLayout("seam","compact","right",3);
    const top=notchLayout("seam","compact","top",3);
    expect([top.core.width,top.core.height]).toEqual([side.core.height,side.core.width]);
    const ribbon=notchLayout("ribbon","compact","left",3);
    expect([ribbon.core.width,ribbon.core.height]).toEqual([72,244]);
  });
  it("reclaims the satellite wings in compact mode",()=>{
    for(const anchor of ["left","right","top","bottom"]){
      const layout=notchLayout("satellite","compact",anchor,6);
      expect([layout.width,layout.height]).toEqual([64,84]);
    }
  });
  it("provides eight distinct compact footprints with bounded provider-count growth", () => {
    expect(NOTCH_FORMS).toHaveLength(8);
    const footprints = new Set(NOTCH_FORMS.map(form => JSON.stringify(notchLayout(form,"compact","right",6).core)));
    expect(footprints.size).toBe(8);
    for (const form of NOTCH_FORMS) {
      expect(notchLayout(form,"compact","right",6)).toEqual(notchLayout(form,"compact","right",20));
    }
  });
  it("keeps instruments and detail cards within every anchored envelope", () => {
    for (const form of NOTCH_FORMS) for (const anchor of ["left","right","top","bottom","top-left","top-right","bottom-left","bottom-right","free"]) {
      for (const count of [0,1,2,6]) {
        const layout = notchLayout(form,"expanded",anchor,count);
        for (const rect of [layout.core, ...(layout.detail ? [layout.detail] : [])]) {
          expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.y).toBeGreaterThanOrEqual(0);
          expect(rect.x+rect.width).toBeLessThanOrEqual(layout.width);
          expect(rect.y+rect.height).toBeLessThanOrEqual(layout.height);
        }
        for (const source of notchNodes(form,count)) {
          const node=notchRotates(form,anchor,"expanded",count)?rotateNotchNode(source,layout.core,anchor):source;
          expect(node.x-node.size/2).toBeGreaterThanOrEqual(0);
          expect(node.y-node.size/2).toBeGreaterThanOrEqual(0);
          expect(node.x+node.size/2).toBeLessThanOrEqual(layout.core.width);
          expect(node.y+node.size/2+18).toBeLessThanOrEqual(layout.core.height);
        }
      }
    }
  });
  it("uses provider identity colors independent of order", () => {
    expect(providerAccent("claude")).toBe("#ff681c");
    expect(providerAccent("openai")).toBe(providerAccent("codex"));
  });
  it("retracts to a small reachable tab and never opens details for empty data", () => {
    for (const form of NOTCH_FORMS) {
      expect(notchLayout(form,"hidden","right",6).width).toBe(24);
      expect(notchLayout(form,"expanded","right",0).detail).toBeUndefined();
    }
  });
});
