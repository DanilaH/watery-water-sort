export type Point={x:number;y:number};
export function clip(poly:Point[], y:number, below:boolean):Point[]{
  const out:Point[]=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],insideA=below?a.y>=y:a.y<=y,insideB=below?b.y>=y:b.y<=y;
    if(insideA)out.push(a);
    if(insideA!==insideB){const t=(y-a.y)/(b.y-a.y);out.push({x:a.x+(b.x-a.x)*t,y});}
  }return out;
}
export function area(poly:Point[]):number {return Math.abs(poly.reduce((s,p,i)=>{const q=poly[(i+1)%poly.length];return s+p.x*q.y-q.x*p.y;},0))/2;}
export function surface(poly:Point[],fraction:number):number{
  let lo=Math.min(...poly.map(p=>p.y)),hi=Math.max(...poly.map(p=>p.y));const target=area(poly)*Math.max(0,Math.min(1,fraction));
  for(let i=0;i<18;i++){const mid=(lo+hi)/2;if(area(clip(poly,mid,true))>target)lo=mid;else hi=mid;}return (lo+hi)/2;
}
export type TubePose={x:number;y:number;w:number;h:number;hitW:number;hitH:number;hitY?:number};
export function layout(width:number,height:number,count:number,touchGap?:number):TubePose[]{
  const padding=8,headroom=Math.min(62,Math.max(24,height*.09));
  const usableW=Math.max(1,width-padding*2),usableH=Math.max(1,height-headroom-padding*2);
  let best={cols:2,rows:Math.ceil(count/2),pitchX:0,pitchY:0,w:0,h:0,score:-1};
  const hitGap=touchGap??(width<340&&count>10?2:6);
  const maxCols=Math.min(6,count,Math.max(2,Math.floor(usableW/(48+hitGap))));
  for(let cols=2;cols<=maxCols;cols++){
    const rows=Math.ceil(count/cols),pitchX=usableW/cols,pitchY=usableH/rows;
    const verticalGap=height<320?16:height<420?24:32;
    const h=Math.max(18,Math.min(250,pitchY-verticalGap,pitchX*2.85));
    const w=Math.max(18,Math.min(62,pitchX*.61,h*.34));
    const score=Math.sqrt(w*h)*(1+.17*Math.max(0,3-rows));
    if(score>best.score)best={cols,rows,pitchX,pitchY,w,h,score};
  }
  return Array.from({length:count},(_,i)=>{
    const row=Math.floor(i/best.cols),inRow=Math.min(best.cols,count-row*best.cols);
    return {x:width/2+(i%best.cols-(inRow-1)/2)*best.pitchX,
      y:padding+headroom+row*best.pitchY+(best.pitchY-best.h)/2,
      w:best.w,h:best.h,hitW:Math.min(best.pitchX-hitGap,Math.max(48,best.w*1.35)),hitH:Math.min(best.pitchY-6,Math.max(48,best.h+20))};
  });
}
/** Shared inner silhouette for both rendering and the outlet/volume calculation. */
export function vesselPolygon(width:number,height:number):Point[]{
 const r=width/2,poly=[{x:-r,y:0},{x:r,y:0},{x:r,y:height-r}];
 for(let n=1;n<=32;n++){const a=n*Math.PI/32;poly.push({x:Math.cos(a)*r,y:height-r+Math.sin(a)*r});}
 return poly;
}
export const LIQUID_FILL=.87;
export function pourTilt(width:number,height:number,units:number):number{
 const shape=vesselPolygon(width,height),target=area(shape)*LIQUID_FILL*Math.max(0,Math.min(4,units))/4;
 let lo=0,hi=Math.PI/2;
 // At the required tilt, the volume below the lower lip equals the remaining liquid.
 for(let i=0;i<20;i++){const mid=(lo+hi)/2,c=Math.cos(mid),s=Math.sin(mid),poly=shape.map(p=>({x:p.x*c-p.y*s,y:p.x*s+p.y*c}));
  if(area(clip(poly,width/2*s,true))>target)lo=mid;else hi=mid;
 }
 return (lo+hi)/2;
}
export const pourTransfer=(t:number)=>{const u=Math.max(0,Math.min(1,(t-.25)/.48));return u*u*(3-2*u);};
export function pourTiming(amount:number,fast=false){
 const speed=fast ? .7 : 1,lift=125*speed,flow=(145+42*Math.max(1,Math.min(4,amount)))*speed,back=100*speed;
 return {lift,flow,back,duration:lift+flow+back};
}
/** Preserve the geometry's phase boundaries while giving each phase its own real time. */
export function pourFrame(elapsed:number,timing:ReturnType<typeof pourTiming>){
 const {lift,flow,back}=timing;
 const t=elapsed<lift ? .25*Math.max(0,elapsed)/lift : elapsed<lift+flow ? .25+.48*(elapsed-lift)/flow : Math.min(1,.73+.27*(elapsed-lift-flow)/back);
 return {t,remaining:Math.max(0,lift+flow-elapsed),tail:elapsed-lift-flow};
}
export type PourPlan={dir:number;startUnits:number;endUnits:number};
export function bounds(r:{x:number;y:number;w:number;h:number},angle:number){
 const c=Math.cos(angle),s=Math.sin(angle),points=[[-r.w/2,0],[r.w/2,0],[-r.w/2,r.h],[r.w/2,r.h]].map(([x,y])=>({x:r.x+x*c-y*s,y:r.y+x*s+y*c}));
 return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};
}
function targetPose(origin:TubePose,dest:TubePose,dir:number,angle:number){
 const tip=dir*origin.w/2;
 return {...origin,x:dest.x-tip*Math.cos(angle),y:dest.y-18-tip*Math.sin(angle),angle};
}
export function planPour(origin:TubePose,dest:TubePose,width:number,height:number,startUnits=4,endUnits=0):PourPlan{
 const preferred=dest.x<width/2?-1:1;
 let best:PourPlan={dir:preferred,startUnits,endUnits},score=Infinity;
 for(const dir of [preferred,-preferred]){
  let overflow=0;
  for(const units of [startUnits,(startUnits+endUnits)/2,endUnits]){
   const angle=dir*pourTilt(origin.w,origin.h,units),b=bounds(targetPose(origin,dest,dir,angle),angle);
   overflow+=Math.max(0,6-b.left)+Math.max(0,b.right-width+6)+Math.max(0,6-b.top)+Math.max(0,b.bottom-height+6);
  }
  if(overflow<score){score=overflow;best={dir,startUnits,endUnits};}
 }
 return best;
}
export function pourPose(origin:TubePose,dest:TubePose,t:number,width:number,height:number,lifted=0,plan=planPour(origin,dest,width,height)){
 const ease=(v:number)=>{const u=Math.max(0,Math.min(1,v));return u*u*u*(u*(u*6-15)+10);},travel=t<.25?ease(t/.25):t>.73?1-ease((t-.73)/.27):1;
 const units=plan.startUnits+(plan.endUnits-plan.startUnits)*pourTransfer(t);
 const angle=plan.dir*pourTilt(origin.w,origin.h,units)*travel;
 const target=targetPose(origin,dest,plan.dir,angle);
 const r={...origin,x:origin.x+(target.x-origin.x)*travel,y:origin.y+lifted+(target.y-origin.y-lifted)*travel-Math.sin(Math.PI*travel)*Math.min(18,origin.h*.13)};
 const b=bounds(r,angle);r.x+=Math.max(0,5-b.left)-Math.max(0,b.right-width+5);r.y+=Math.max(0,5-b.top)-Math.max(0,b.bottom-height+5);
 return {...r,angle,tipX:plan.dir*origin.w/2};
}

/** A permanent goal column keeps the tall receiver and every ordinary touch target separate. */
export function goalLayout(width:number,height:number,count:number,goalIndex:number|readonly number[]):TubePose[]{
 const indices=typeof goalIndex==='number'?[goalIndex]:goalIndex;
 if(indices.length>1)return dualGoalLayout(width,height,count,indices);
 goalIndex=indices[0];
 const column=width<340?64:Math.max(64,Math.min(110,width*.24)),gap=4;
 const normal=layout(width-column-gap,height,count-1,2).map(r=>{
  const h=Math.min(r.h,156,Math.max(48,(height-48)*.57)),w=Math.min(r.w,h*.34);
  return {...r,x:r.x+column+gap,y:r.y+(r.h-h)/2,w,h,hitH:Math.min(r.hitH,Math.max(48,h+20))};
 });
 const top=Math.min(...normal.map(r=>r.y)),bottom=Math.max(...normal.map(r=>r.y+r.h)),h=bottom-top;
 const goal={x:column/2+2,y:top,w:Math.min(column-16,68,h*.5),h,hitW:column-8,hitH:Math.max(48,h+18)};
 const poses:TubePose[]=[];let n=0;for(let i=0;i<count;i++)poses.push(i===goalIndex?goal:normal[n++]);return poses;
}

/** Two fixed receivers flank the ordinary bank, aligned to its complete row span. */
function dualGoalLayout(width:number,height:number,count:number,indices:readonly number[]):TubePose[]{
 const column=Math.max(56,Math.min(86,width*.19)),gap=4;
 const normal=layout(width-column*2-gap*2,height,count-2,2).map(r=>{
  const h=Math.min(r.h,156,Math.max(48,(height-48)*.57)),w=Math.min(r.w,h*.34);
  return {...r,x:r.x+column+gap,y:r.y+(r.h-h)/2,w,h,hitH:Math.min(r.hitH,Math.max(48,h+20))};
 });
 const top=Math.min(...normal.map(r=>r.y)),bottom=Math.max(...normal.map(r=>r.y+r.h)),h=bottom-top;
 const receiver=(right:boolean):TubePose=>({x:right?width-column/2:column/2,y:top,w:Math.min(column-18,68,h*.5),h,hitW:column-8,hitH:Math.max(48,h+18)});
 let n=0;return Array.from({length:count},(_,i)=>indices.includes(i)?receiver(i===indices[1]):normal[n++]);
}

/** Keep the old cell's hit area; only the two-unit glass becomes shorter, anchored to its row. */
export function miniLayout(poses:TubePose[],index:number|undefined):TubePose[]{
 if(index===undefined||!poses[index])return poses;
 return poses.map((r,i)=>{if(i!==index)return r;const h=Math.min(r.h,Math.max(20,r.h*.5+r.w*.054));return {...r,y:r.y+r.h-h,h,hitY:r.y+r.h/2};});
}
