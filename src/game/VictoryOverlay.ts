type Pose={x:number;y:number;w:number;h:number};
type Burst={index:number;start:number;color:number;order?:number;heavy?:boolean};
/** Screen coordinates keep celebration independent of puzzle clipping and hit targets. */
export class VictoryOverlay{
 private canvas?:HTMLCanvasElement;
 private sprites:HTMLImageElement[]=[];
 private tinted=new Map<number,HTMLCanvasElement[]>();
 /** Generated neutral sprites are colourised once, preserving their white speculars. */
 setSprites(sprites:HTMLImageElement[],colours:number[]){
  this.sprites=sprites;this.tinted.clear();
  for(const colour of colours)this.tinted.set(colour,sprites.map(image=>{
   const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,c.width,c.height),rgb=[colour>>16&255,colour>>8&255,colour&255];
   for(let i=0;i<data.data.length;i+=4){const grey=(data.data[i]+data.data[i+1]+data.data[i+2])/3,shade=.65+.35*grey/255,shine=Math.max(0,(grey-205)/50)**2*.85;for(let k=0;k<3;k++)data.data[i+k]=rgb[k]*shade*(1-shine)+255*shine;}
   ctx.putImageData(data,0,0);return c;
  }));
 }
 private sprite(ctx:CanvasRenderingContext2D,colour:number,kind:number,x:number,y:number,size:number,rotation:number,alpha:number){
  const image=kind===5?this.sprites[5]:this.tinted.get(colour)?.[kind];if(!image)return false;
  ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.globalAlpha=Math.max(0,Math.min(1,alpha));ctx.drawImage(image,-size/2,-size/2,size,size);ctx.restore();return true;
 }
 clear(){this.canvas?.remove();this.canvas=undefined;}
 draw(bursts:Burst[],poses:Pose[],now:number,reduced:boolean){
  const active=bursts.filter(b=>now>=b.start&&now-b.start<1900);
  if(!active.length){this.clear();return;}
  if(!this.canvas){this.canvas=document.createElement('canvas');this.canvas.id='victory-effects';this.canvas.setAttribute('aria-hidden','true');document.body.append(this.canvas);}
  const canvas=this.canvas,dpr=Math.min(3,Math.max(2,devicePixelRatio||1)),width=innerWidth,height=innerHeight;
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
  const ctx=canvas.getContext('2d')!;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const board=document.getElementById('board')!.getBoundingClientRect();
  for(const b of active){
   const r=poses[b.index],age=(now-b.start)/1000,x=board.x+r.x,y=board.y+r.y,colour='#'+b.color.toString(16).padStart(6,'0');
   if(reduced){ctx.globalAlpha=Math.max(0,1-age/.4)*.35;ctx.fillStyle=colour;ctx.beginPath();ctx.ellipse(x,y+r.h*.5,r.w*.8,r.h*.5,0,0,Math.PI*2);ctx.fill();continue;}
   // Apex stays below the top safe edge. Low bottles retain a taller fountain.
   const gravity=850,velocity=Math.min(510,Math.sqrt(2*gravity*Math.max(12,y-38))),vx=(width*.5-x)*1.3;
   // One broad opening splash gives the launch a recognisable silhouette.
   if(age<.42){const p=age/.42,size=r.w*(b.heavy?2.5:2)*(1-Math.pow(1-p,3));this.sprite(ctx,b.color,3,x,Math.max(size/2+6,y-p*24),size,Math.sin(b.index)*.18,Math.sin(Math.PI*p)*.9);}
   const head=Math.min(.62,age),tail=Math.max(0,age-.25);
   if(age<.85&&head>tail){ctx.strokeStyle=colour;ctx.globalAlpha=Math.min(1,age*20)*Math.max(0,1-(age-.4)/.45);ctx.lineWidth=Math.max(4,r.w*(b.heavy?.2:.13));ctx.lineCap='round';ctx.beginPath();for(let n=0;n<=24;n++){const t=tail+(head-tail)*n/24,px=x+vx*t,py=y-velocity*t+gravity*t*t/2;n?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.stroke();}
   for(let n=0;n<(b.heavy?96:64);n++){
    const t=age-(n%16)*.012;if(t<0||t>1.65)continue;
    const dx=vx+Math.sin(n*4.9+b.index)*(b.heavy?175:140),vy=-velocity*(.66+(n%7)*.05),px=x+dx*t,py=y+vy*t+gravity*t*t/2,size=(2+(n%5)*.65)*(b.heavy?1.4:1);
    const alpha=Math.min(1,t*22)*Math.min(1,(1.65-t)/.55),hero=n%8===0,kind=hero?(n%16===0?4:2):n%3,scale=hero?size*6:size*3.7,rotation=hero?Math.sin(n)*.5+t*(n%2?1.6:-1.6):Math.atan2(vy+gravity*t,dx)+Math.PI/2;
    if(!this.sprite(ctx,b.color,kind,px,py,scale,rotation,alpha*.92)){ctx.globalAlpha=alpha;ctx.fillStyle=colour;ctx.beginPath();ctx.ellipse(px,py,size,size*1.5,rotation,0,Math.PI*2);ctx.fill();}
    if(n%13===0&&t<.9){const flash=Math.sin(Math.PI*Math.min(1,t/.9));this.sprite(ctx,b.color,5,px+size*1.2,py-size,8+flash*8,t*.7,flash*.8);}
   }
   // The cork uses the same bounded trajectory and is never redrawn in the glass layer.
   if(age<.9){ctx.globalAlpha=Math.max(0,1-age/.9);ctx.save();ctx.translate(x+Math.sin(b.index*2.4)*age*65,y-12-velocity*.75*age+gravity*age*age/2);ctx.rotate(age*(b.index%2?3:-3));ctx.fillStyle='#ce9a59';ctx.fillRect(-r.w*.42,-5,r.w*.84,12);ctx.fillStyle='#e9bd7b';ctx.fillRect(-r.w*.42,-5,r.w*.84,4);ctx.restore();}
  }
  ctx.globalAlpha=1;
 }
}
