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
export type TubePose={x:number;y:number;w:number;h:number;hitW:number;hitH:number};
export function layout(width:number,height:number,count:number):TubePose[]{
  const padding=8,headroom=Math.min(78,Math.max(30,height*.12));
  const usableW=Math.max(1,width-padding*2),usableH=Math.max(1,height-headroom-padding*2);
  let best={cols:2,rows:Math.ceil(count/2),pitchX:0,pitchY:0,w:0,h:0,score:-1};
  const maxCols=Math.min(6,count,Math.max(2,Math.floor(usableW/56)));
  for(let cols=2;cols<=maxCols;cols++){
    const rows=Math.ceil(count/cols),pitchX=usableW/cols,pitchY=usableH/rows;
    const verticalGap=height<230?14:height<420?24:32;
    const h=Math.max(18,Math.min(218,pitchY-verticalGap,pitchX*2.55));
    const w=Math.max(18,Math.min(54,pitchX*.53,h*.285));
    const score=Math.sqrt(w*h)*(1+.17*Math.max(0,3-rows));
    if(score>best.score)best={cols,rows,pitchX,pitchY,w,h,score};
  }
  return Array.from({length:count},(_,i)=>{
    const row=Math.floor(i/best.cols),inRow=Math.min(best.cols,count-row*best.cols);
    return {x:width/2+(i%best.cols-(inRow-1)/2)*best.pitchX,
      y:padding+headroom+row*best.pitchY+(best.pitchY-best.h)/2,
      w:best.w,h:best.h,hitW:Math.min(best.pitchX-6,Math.max(48,best.w*1.35)),hitH:Math.min(best.pitchY-6,Math.max(48,best.h+20))};
  });
}
export type PourPlan={dir:number;tilt:number};
export function bounds(r:{x:number;y:number;w:number;h:number},angle:number){
 const c=Math.cos(angle),s=Math.sin(angle),points=[[-r.w/2,0],[r.w/2,0],[-r.w/2,r.h],[r.w/2,r.h]].map(([x,y])=>({x:r.x+x*c-y*s,y:r.y+x*s+y*c}));
 return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};
}
function targetPose(origin:TubePose,dest:TubePose,plan:PourPlan){
 const angle=plan.dir*plan.tilt,tip=plan.dir*origin.w/2;
 return {...origin,x:dest.x-tip*Math.cos(angle),y:dest.y-18-tip*Math.sin(angle),angle};
}
export function planPour(origin:TubePose,dest:TubePose,width:number,height:number):PourPlan{
 let best={dir:dest.x<width/2?-1:1,tilt:.75},score=Infinity;
 for(const tilt of [1.1,1,.9,.8,.7])for(const dir of [-1,1]){
  const b=bounds(targetPose(origin,dest,{dir,tilt}),dir*tilt);
  const overflow=Math.max(0,6-b.left)+Math.max(0,b.right-width+6)+Math.max(0,6-b.top)+Math.max(0,b.bottom-height+6);
  const value=overflow*100+(1.1-tilt)*10+(dir===best.dir?0:.01);
  if(value<score){score=value;best={dir,tilt};}
 }
 return best;
}
export function pourPose(origin:TubePose,dest:TubePose,t:number,width:number,height:number,lifted=0,plan=planPour(origin,dest,width,height)){
 const ease=(v:number)=>1-Math.pow(1-v,3),travel=t<.25?ease(t/.25):t>.73?1-ease((t-.73)/.27):1;
 const target=targetPose(origin,dest,plan),angle=plan.dir*plan.tilt*travel;
 const r={...origin,x:origin.x+(target.x-origin.x)*travel,y:origin.y+lifted+(target.y-origin.y-lifted)*travel-Math.sin(Math.PI*travel)*Math.min(18,origin.h*.13)};
 const b=bounds(r,angle);r.x+=Math.max(0,5-b.left)-Math.max(0,b.right-width+5);r.y+=Math.max(0,5-b.top)-Math.max(0,b.bottom-height+5);
 return {...r,angle,tipX:plan.dir*origin.w/2};
}
