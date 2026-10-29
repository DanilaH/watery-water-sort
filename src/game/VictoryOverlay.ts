type Pose={x:number;y:number;w:number;h:number};
type Burst={index:number;start:number;color:number;order?:number;heavy?:boolean};
/** Screen coordinates keep celebration independent of puzzle clipping and hit targets. */
export class VictoryOverlay{
 private canvas?:HTMLCanvasElement;
 clear(){this.canvas?.remove();this.canvas=undefined;}
 draw(bursts:Burst[],poses:Pose[],now:number,reduced:boolean){
  const active=bursts.filter(b=>now>=b.start&&now-b.start<1900);
  if(!active.length){this.clear();return;}
  if(!this.canvas){this.canvas=document.createElement('canvas');this.canvas.id='victory-effects';this.canvas.setAttribute('aria-hidden','true');document.body.append(this.canvas);}
  const canvas=this.canvas,dpr=Math.min(2,devicePixelRatio||1),width=innerWidth,height=innerHeight;
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
  const ctx=canvas.getContext('2d')!;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const board=document.getElementById('board')!.getBoundingClientRect();
  for(const b of active){
   const r=poses[b.index],age=(now-b.start)/1000,x=board.x+r.x,y=board.y+r.y,colour='#'+b.color.toString(16).padStart(6,'0');
   if(reduced){ctx.globalAlpha=Math.max(0,1-age/.4)*.35;ctx.fillStyle=colour;ctx.beginPath();ctx.ellipse(x,y+r.h*.5,r.w*.8,r.h*.5,0,0,Math.PI*2);ctx.fill();continue;}
   // Apex stays below the top safe edge. Low bottles retain a taller fountain.
   const gravity=850,velocity=Math.min(510,Math.sqrt(2*gravity*Math.max(12,y-38))),vx=(width*.5-x)*1.3;
   const head=Math.min(.62,age),tail=Math.max(0,age-.25);
   if(age<.85&&head>tail){ctx.strokeStyle=colour;ctx.globalAlpha=Math.min(1,age*20)*Math.max(0,1-(age-.4)/.45);ctx.lineWidth=Math.max(4,r.w*(b.heavy?.2:.13));ctx.lineCap='round';ctx.beginPath();for(let n=0;n<=24;n++){const t=tail+(head-tail)*n/24,px=x+vx*t,py=y-velocity*t+gravity*t*t/2;n?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.stroke();}
   for(let n=0;n<(b.heavy?96:64);n++){
    const t=age-(n%16)*.012;if(t<0||t>1.65)continue;
    const dx=vx+Math.sin(n*4.9+b.index)*(b.heavy?175:140),vy=-velocity*(.66+(n%7)*.05),px=x+dx*t,py=y+vy*t+gravity*t*t/2,size=(2+(n%5)*.65)*(b.heavy?1.4:1);
    ctx.globalAlpha=Math.min(1,t*22)*Math.max(0,1-t/1.65);ctx.fillStyle=colour;ctx.beginPath();ctx.ellipse(px,py,size,size*(1.2+Math.min(1,Math.abs(vy+gravity*t)/300)),Math.sin(n)*.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffffff';ctx.globalAlpha*=.55;ctx.beginPath();ctx.arc(px-.7,py-1,size*.3,0,Math.PI*2);ctx.fill();
   }
   // The cork uses the same bounded trajectory and is never redrawn in the glass layer.
   if(age<.9){ctx.globalAlpha=Math.max(0,1-age/.9);ctx.save();ctx.translate(x+Math.sin(b.index*2.4)*age*65,y-12-velocity*.75*age+gravity*age*age/2);ctx.rotate(age*(b.index%2?3:-3));ctx.fillStyle='#ce9a59';ctx.fillRect(-r.w*.42,-5,r.w*.84,12);ctx.fillStyle='#e9bd7b';ctx.fillRect(-r.w*.42,-5,r.w*.84,4);ctx.restore();}
  }
  ctx.globalAlpha=1;
 }
}
