import {area,clip,surface,vesselPolygon} from './geometry';
import {COLORS} from './WaterScene';

/** Render the menu illustration from the same glass and palette as the live board. */
export async function mountHomeHero(){
  const fallback=document.querySelector('.home-hero');if(!fallback)return;
  const glass=new Image();glass.src='art/glass/tube-27.webp';
  try{await glass.decode();}catch{return;}
  const density=Math.min(3,Math.max(2,devicePixelRatio)),canvas=document.createElement('canvas');canvas.width=300*density;canvas.height=270*density;
  const ctx=canvas.getContext('2d');if(!ctx)return;ctx.scale(density,density);ctx.imageSmoothingQuality='high';
  const path=(points:{x:number;y:number}[])=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();};
  const hex=(c:number)=>'#'+c.toString(16).padStart(6,'0');
  const mix=(c:number,t:number)=>`rgb(${[c>>16&255,c>>8&255,c&255].map(v=>Math.round(v+(255-v)*t)).join(',')})`;
  ctx.fillStyle='#08162c25';ctx.beginPath();ctx.ellipse(150,248,91,6,0,0,Math.PI*2);ctx.fill();
  for(const p of [{x:88,y:61,w:42,h:175,a:-.20,colors:[2,0]},{x:212,y:64,w:42,h:175,a:.20,colors:[2,1]},{x:150,y:36,w:48,h:183,a:0,colors:[0,0]}]){
    const c=Math.cos(p.a),s=Math.sin(p.a),poly=vesselPolygon(p.w,p.h).map(v=>({x:p.x+v.x*c-v.y*s,y:p.y+v.x*s+v.y*c}));
    for(let i=0;i<2;i++){
      const low=surface(poly,i*.39),high=surface(poly,(i+1)*.39),band=clip(clip(poly,high,true),low,false);if(area(band)<.01)continue;
      const color=COLORS[p.colors[i]],gradient=ctx.createLinearGradient(p.x-p.w/2,0,p.x+p.w/2,0);gradient.addColorStop(0,hex(color));gradient.addColorStop(.18,mix(color,.17));gradient.addColorStop(.36,hex(color));gradient.addColorStop(1,hex(color));path(band);ctx.fillStyle=gradient;ctx.fill();
    }
    const scale=p.w/204,h=p.h/scale+66;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);ctx.scale(scale,scale);
    ctx.drawImage(glass,0,0,276,80,-138,-27,276,80);ctx.drawImage(glass,0,80,276,630,-138,53,276,h-250);ctx.drawImage(glass,0,710,276,170,-138,h-197,276,170);ctx.restore();
  }
  const image=new Image();image.className='home-hero';image.width=300;image.height=270;image.alt='';image.setAttribute('aria-hidden','true');image.dataset.material='glass';image.src=canvas.toDataURL('image/png');
  try{await image.decode();fallback.replaceWith(image);}catch{/* Keep the original vector illustration if decoding fails. */}
}
