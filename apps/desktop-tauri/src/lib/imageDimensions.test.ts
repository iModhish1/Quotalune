import {describe,it,expect,vi} from "vitest";
import {imageDimensions} from "./imageDimensions";
import {importWorkspaceBackground} from "./workspaceBackgrounds";
function png(width:number,height:number){
  const bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10]);bytes.set([73,72,68,82],12);
  const view=new DataView(bytes.buffer);view.setUint32(16,width);view.setUint32(20,height);return bytes;
}
describe("image dimension preflight",()=>{
  it("reads PNG and JPEG size before pixel decoding",()=>{
    expect(imageDimensions(png(1200,800))).toEqual({width:1200,height:800});
    expect(imageDimensions(new Uint8Array([255,216,255,192,0,8,8,3,32,4,176,3]))).toEqual({width:1200,height:800});
  });
  it("reads supported WebP headers and rejects animation",()=>{
    const bytes=new Uint8Array(30);bytes.set(new TextEncoder().encode("RIFF"));bytes.set(new TextEncoder().encode("WEBPVP8X"),8);bytes[24]=99;bytes[27]=49;
    expect(imageDimensions(bytes)).toEqual({width:100,height:50});
    bytes[20]=2;expect(()=>imageDimensions(bytes)).toThrow();
  });
  it("rejects truncated or invalid files",()=>{
    for(const bytes of [new Uint8Array(),png(4,4).slice(0,19),new Uint8Array([255,216,255,192,0,0])])expect(()=>imageDimensions(bytes)).toThrow();
  });
  it("rejects a compressed oversized header without calling the browser decoder",async()=>{
    const decoder=vi.fn();vi.stubGlobal("createImageBitmap",decoder);
    const bytes=png(30000,30000);
    const file={type:"image/png",size:bytes.length,arrayBuffer:async()=>bytes.buffer} as File;
    await expect(importWorkspaceBackground(file)).rejects.toThrow("image-too-large");
    expect(decoder).not.toHaveBeenCalled();vi.unstubAllGlobals();
  });
});
