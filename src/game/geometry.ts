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
export function layout(width:number,height:number,count:number){
  // Always reserve the extra-tube cell; do not move existing cells when help is granted.
  const rowScale=height>width*1.15?2.3:1.75, tubeScale=height>width*1.15?1.8:1.35;
  let best={cols:2,rows:2,size:0};
  for(let cols=2;cols<=6;cols++){
    const rows=Math.ceil(count/cols),size=Math.min((width-8)/cols,(height-8)/(rows*rowScale),100);
    if(size>best.size)best={cols,rows,size};
  }
  const gap=best.size, h=best.size*tubeScale;
  return Array.from({length:count},(_,i)=>{
    const row=Math.floor(i/best.cols),rowCount=Math.min(best.cols,count-row*best.cols);
    return {x:width/2+(i%best.cols-(rowCount-1)/2)*gap,y:height/2+(row-(best.rows-1)/2)*gap*rowScale-h/2,w:gap*.62,h};
  });
}
