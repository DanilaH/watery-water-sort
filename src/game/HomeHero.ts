import {vesselPolygon,type Point} from './geometry';
import {liquidMesh,liquidContour} from './liquidSurface';
import {COLORS} from './WaterScene';

/** Menu-only SVG: shared glass, joined liquid contours, no extra DOM canvas. */
export async function mountHomeHero(){
  const fallback=document.querySelector('.home-hero');if(!fallback)return;
  const glass=new Image();glass.src='art/glass/tube-27.webp';
  try{await glass.decode();}catch{return;}
  const ns='http://www.w3.org/2000/svg';
  const el=<K extends keyof SVGElementTagNameMap>(tag:K,attrs:Record<string,string|number>={})=>{
    const node=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));return node;
  };
  const path=(points:Point[])=>points.length?'M'+points.map(p=>p.x.toFixed(3)+','+p.y.toFixed(3)).join('L')+'Z':'';
  const hex=(c:number)=>'#'+c.toString(16).padStart(6,'0');
  const mix=(c:number,t:number)=>'rgb('+[c>>16&255,c>>8&255,c&255].map(v=>Math.round(v+(255-v)*t)).join(',')+')';
  const root=el('svg',{viewBox:'0 0 300 270','aria-hidden':'true',focusable:'false',class:'home-hero'}),defs=el('defs');
  root.dataset.material='glass';root.append(defs);
  const sheen=el('linearGradient',{id:'hero-sheen',x1:'0%',y1:'0%',x2:'0%',y2:'100%'});
  for(const [at,opacity]of [[0,0],[.5,.26],[1,0]])sheen.append(el('stop',{offset:at,'stop-color':'white','stop-opacity':opacity}));defs.append(sheen);
  const shadow=el('ellipse',{cx:150,cy:248,rx:91,ry:6,fill:'#08162c25'});root.append(shadow);
  const vessels=[{x:88,y:61,w:42,h:175,a:-.20,colors:[2,0],phase:0},{x:212,y:64,w:42,h:175,a:.20,colors:[2,1],phase:2.1},{x:150,y:36,w:48,h:183,a:0,colors:[0,0],phase:4.2}].map((p,index)=>{
    const colors=p.colors[0]===p.colors[1]?[p.colors[0]]:p.colors;
    const shape=vesselPolygon(p.w,p.h),group=el('g'),bands=colors.map((c,i)=>{
      const id='hero-liquid-'+index+'-'+i,gradient=el('linearGradient',{id,x1:'0%',x2:'100%'});
      for(const [at,color]of [[0,hex(COLORS[c])],[.18,mix(COLORS[c],.17)],[.36,hex(COLORS[c])],[1,hex(COLORS[c])]] as const)gradient.append(el('stop',{offset:at,'stop-color':color}));defs.append(gradient);
      // A subpixel same-colour stroke seals antialiasing at the shared boundary.
      const band=el('path',{fill:'url(#'+id+')',stroke:'url(#'+id+')','stroke-width':.45,'stroke-linejoin':'round'});group.append(band);return band;
    });
    const mask=el('path'),clip=el('clipPath',{id:'hero-clip-'+index});clip.append(mask);defs.append(clip);
    const shine=el('path',{fill:'url(#hero-sheen)','clip-path':'url(#hero-clip-'+index+')'});group.append(shine);
    const material=el('g'),scale=p.w/204,height=p.h/scale+66;
    for(const [sourceY,sourceH,y,h]of [[0,80,-27,80],[80,630,53,height-250],[710,170,height-197,170]]){
      const slice=el('svg',{x:-138,y,width:276,height:h,viewBox:'0 '+sourceY+' 276 '+sourceH,preserveAspectRatio:'none',overflow:'hidden'});
      slice.append(el('image',{href:glass.src,width:276,height:880}));material.append(slice);
    }
    group.append(material);root.append(group);return {...p,shape,bands,mask,shine,material,scale};
  });
  const draw=(time:number,quiet=false)=>{
    const phase=time/7200*Math.PI*2;
    for(const p of vessels){
      const t=phase+p.phase,x=p.x+(quiet?0:Math.sin(t)*2),y=p.y+(quiet?0:Math.sin(t)*3),a=p.a+(quiet?0:Math.sin(t)*.04),c=Math.cos(a),s=Math.sin(a);
      const poly=p.shape.map(v=>({x:x+v.x*c-v.y*s,y:y+v.x*s+v.y*c}));
      const mesh=liquidMesh(poly,p.bands.length===1?[0,.78]:[0,.39,.78],quiet?0:Math.sin(t*2+.7)*2.8+Math.cos(t)*1.2,p.h,24);
      p.bands.forEach((band,i)=>band.setAttribute('d',path(liquidContour(mesh,i,i+1))));
      p.mask.setAttribute('d',path(liquidContour(mesh,0,p.bands.length)));
      const sweep=((phase/(Math.PI*2)+p.phase/(Math.PI*2))%1+1)%1,sy=y+p.h+55-sweep*(p.h+120);
      p.shine.setAttribute('d','M'+(x-110)+','+(sy+15)+'l220,-30v34l-220,30Z');p.shine.setAttribute('opacity',quiet?'0':'1');
      p.material.setAttribute('transform','translate('+x+' '+y+') rotate('+(a*180/Math.PI)+') scale('+p.scale+')');
    }
    shadow.setAttribute('rx',String(91+(quiet?0:Math.sin(phase)*2)));
  };
  let frame=0,elapsed=0,last=0,painted=-Infinity,playing=false,quiet=false;
  const tick=(now:number)=>{
    if(!playing)return;
    // Resume from the last visible pose; background time never jumps the loop.
    if(last)elapsed+=Math.min(50,now-last);last=now;
    if(now-painted>=1000/30){draw(elapsed);painted=now;}
    frame=requestAnimationFrame(tick);
  };
  draw(0);fallback.replaceWith(root);
  return {setActive(active:boolean,reduced:boolean){
    const next=active&&!reduced;
    if(reduced!==quiet){quiet=reduced;if(quiet)draw(0,true);else draw(elapsed);}
    root.dataset.motion=reduced?'reduced':next?'playing':'paused';
    if(playing===next)return;playing=next;cancelAnimationFrame(frame);frame=0;last=0;painted=-Infinity;
    if(playing)frame=requestAnimationFrame(tick);
  }};
}
