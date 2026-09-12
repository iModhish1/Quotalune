/** Decorative stars only: never related to provider usage or analytics. */
export function attachSpaceScene(canvas:HTMLCanvasElement,root:HTMLElement,fps=24) {
 const context=canvas.getContext("2d");if(!context)return ()=>{};
 let width=1,height=1,frame=0,timer:ReturnType<typeof setTimeout>|undefined,disposed=false,last=0,elapsed=0;
 let targetX=0,targetY=0,x=0,y=0;
 const stars=Array.from({length:96},(_,i)=>({x:((i*137.508)%997)/997,y:((i*73.271)%991)/991,z:.3+((i*41)%100)/100,phase:i*2.399}));
 const resize=()=>{const r=root.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);const dpr=Math.min(devicePixelRatio||1,1.25);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);context.setTransform(dpr,0,0,dpr,0,0);};
 const move=(e:PointerEvent)=>{const r=root.getBoundingClientRect();targetX=(e.clientX-r.left)/width-.5;targetY=(e.clientY-r.top)/height-.5;};
 const leave=()=>{targetX=0;targetY=0;};
 const draw=(now:number)=>{
  if(disposed)return;const dt=last?Math.min(100,now-last):0;last=now;elapsed+=dt/1000;x+=(targetX-x)*.09;y+=(targetY-y)*.09;
  context.clearRect(0,0,width,height);
  for(const star of stars){const sx=(star.x*width+elapsed*(3+star.z*7)+x*star.z*48)%width,sy=(star.y*height+Math.sin(elapsed*.08+star.phase)*10+y*star.z*32+height)%height;
   context.globalAlpha=.25+(.5+.5*Math.sin(elapsed*.7+star.phase))*.6;context.fillStyle=star.z>.9?"#c9efff":"#edf4ff";context.beginPath();context.arc(sx,sy,.6+star.z*.8,0,Math.PI*2);context.fill();
   if(star.z>1.22){context.globalAlpha*=.4;context.fillRect(sx-3,sy-.4,6,.8);context.fillRect(sx-.4,sy-3,.8,6);}
  }
  timer=setTimeout(()=>{frame=requestAnimationFrame(draw);},1000/fps);
 };
 resize();const observer=typeof ResizeObserver==="undefined"?null:new ResizeObserver(resize);observer?.observe(root);
 root.addEventListener("pointermove",move,{passive:true});root.addEventListener("pointerleave",leave);frame=requestAnimationFrame(draw);
 return ()=>{disposed=true;cancelAnimationFrame(frame);clearTimeout(timer);observer?.disconnect();root.removeEventListener("pointermove",move);root.removeEventListener("pointerleave",leave);context.clearRect(0,0,width,height);};
}
