/** Inspect bounded file headers before asking the browser to allocate decoded pixels. */
export function imageDimensions(bytes:Uint8Array):{width:number;height:number} {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const fail=():never=>{throw new Error("unsupported-image-header");};
  const u16=(at:number)=>at+2<=bytes.length?view.getUint16(at):fail();
  const u32=(at:number)=>at+4<=bytes.length?view.getUint32(at):fail();
  const ascii=(at:number,n:number)=>String.fromCharCode(...bytes.slice(at,at+n));
  if(bytes.length>=24&&ascii(1,3)==="PNG"&&u32(0)===0x89504e47&&u32(4)===0x0d0a1a0a&&ascii(12,4)==="IHDR") {
    return {width:u32(16),height:u32(20)};
  }
  if(bytes.length>=4&&u16(0)===0xffd8) {
    let at=2;
    while(at+4<=bytes.length) {
      if(bytes[at++]!==0xff) return fail();
      while(bytes[at]===0xff)at++;
      const marker=bytes[at++];
      if(marker===0xda||marker===0xd9)break;
      if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
      const length=u16(at);
      if(length<2||at+length>bytes.length)return fail();
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        if(length<8)return fail();
        return {height:u16(at+3),width:u16(at+5)};
      }
      at+=length;
    }
  }
  if(bytes.length>=30&&ascii(0,4)==="RIFF"&&ascii(8,4)==="WEBP") {
    const kind=ascii(12,4);
    if(kind==="VP8X") {
      if(bytes[20]&2)return fail(); // Animated imports are intentionally unsupported.
      return {width:1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),height:1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)};
    }
    if(kind==="VP8 "&&bytes[23]===0x9d&&bytes[24]===1&&bytes[25]===0x2a) {
      return {width:view.getUint16(26,true)&0x3fff,height:view.getUint16(28,true)&0x3fff};
    }
    if(kind==="VP8L"&&bytes[20]===0x2f) {
      return {width:1+bytes[21]+((bytes[22]&0x3f)<<8),height:1+(bytes[22]>>6)+(bytes[23]<<2)+((bytes[24]&15)<<10)};
    }
  }
  return fail();
}
