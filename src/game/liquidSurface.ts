import {area,surface,type Point} from './geometry';
export type LiquidBoundary={y:number;amplitude:number};
export type LiquidColumn={left:number;right:number;poly:Point[]};
export type LiquidMesh={left:number;right:number;columns:LiquidColumn[];boundaries:LiquidBoundary[]};
export const waveShape=(u:number)=>Math.sin(u*Math.PI*2)*.55+(u-.5)*.9;
function cut(poly:Point[],distance:(p:Point)=>number):Point[]{
 const out:Point[]=[];
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a),db=distance(b);if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}
 return out;
}
export function boundaryY(mesh:Pick<LiquidMesh,'left'|'right'>,b:LiquidBoundary,x:number){return b.y+waveShape((x-mesh.left)/Math.max(.001,mesh.right-mesh.left))*b.amplitude;}
export function cutBoundary(mesh:Pick<LiquidMesh,'left'|'right'>,column:LiquidColumn,poly:Point[],b:LiquidBoundary,below:boolean){
 const a=boundaryY(mesh,b,column.left),slope=(boundaryY(mesh,b,column.right)-a)/(column.right-column.left);
 return cut(poly,p=>(p.y-a-(p.x-column.left)*slope)*(below?1:-1));
}
/** Shared, area-corrected interfaces: adjacent colours use the identical boundary. */
export function liquidMesh(poly:Point[],fractions:number[],displacement:number,height:number,count=28):LiquidMesh{
 const left=Math.min(...poly.map(p=>p.x)),right=Math.max(...poly.map(p=>p.x)),bottom=Math.max(...poly.map(p=>p.y)),ys=fractions.map(f=>surface(poly,f)),mesh:LiquidMesh={left,right,columns:[],boundaries:[]};
 for(let i=0;i<count;i++){const x0=left+(right-left)*i/count,x1=left+(right-left)*(i+1)/count;mesh.columns.push({left:x0,right:x1,poly:cut(cut(poly,p=>p.x-x0),p=>x1-p.x)});}
 const totalArea=area(poly),top=ys.at(-1)!;
 for(let i=0;i<fractions.length;i++){
  const gap=i?Math.min(ys[i-1]-ys[i],i<ys.length-1?ys[i]-ys[i+1]:Infinity):0,limit=Math.max(0,Math.min(4,height*.035,gap*.18));
  const depth=(ys[i]-top)/Math.max(1,bottom-top),amplitude=i?limit*Math.tanh(displacement/Math.max(.1,limit))*(1-.55*depth):0;
  const b={y:ys[i],amplitude};
  if(Math.abs(amplitude)>.002){
   let lo=b.y-Math.abs(amplitude),hi=b.y+Math.abs(amplitude);const wanted=totalArea*fractions[i];
   for(let n=0;n<10;n++){b.y=(lo+hi)/2;let filled=0;for(const c of mesh.columns)filled+=area(cutBoundary(mesh,c,c.poly,b,true));if(filled>wanted)lo=b.y;else hi=b.y;}
   b.y=(lo+hi)/2;
  }
  mesh.boundaries.push(b);
 }
 return mesh;
}
export function liquidBand(mesh:LiquidMesh,column:LiquidColumn,lower:number,upper:number){return cutBoundary(mesh,column,cutBoundary(mesh,column,column.poly,mesh.boundaries[upper],true),mesh.boundaries[lower],false);}

/** Join the column mesh before rasterization so its internal edges cannot show through. */
export function liquidContour(mesh:LiquidMesh,lower:number,upper:number):Point[]{
 const key=(p:Point)=>`${Math.round(p.x*1e7)},${Math.round(p.y*1e7)}`,edges=new Map<string,{a:Point;b:Point}>();
 for(const column of mesh.columns){const band=liquidBand(mesh,column,lower,upper);
  for(let i=0;i<band.length;i++){const a=band[i],b=band[(i+1)%band.length],ka=key(a),kb=key(b);if(ka===kb)continue;const id=ka<kb?ka+'|'+kb:kb+'|'+ka;if(edges.has(id))edges.delete(id);else edges.set(id,{a,b});}
 }
 if(!edges.size)return [];
 const next=new Map([...edges.values()].map(e=>[key(e.a),e])),first=edges.values().next().value!,out:Point[]=[];let edge=first;
 do{out.push(edge.a);next.delete(key(edge.a));const following=next.get(key(edge.b));if(!following)break;edge=following;}while(out.length<=edges.size);
 return out;
}
