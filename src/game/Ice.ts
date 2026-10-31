import type Phaser from 'phaser';
import type {TubePose} from './geometry';
/** A translucent faceted shell. At release, the same facets split into bounded chips. */
export function drawIce(g:Phaser.GameObjects.Graphics,r:TubePose,age:number,reduced:boolean){
 const p=age<0?0:Math.min(1,age/(reduced?180:680)),shell=age<0?1:Math.max(0,1-age/190),x=r.x,w=r.w*.72,y=r.y-7,h=r.h+15;
 const poly=[{x:x-w*.78,y},{x:x+w*.7,y:y-2},{x:x+w,y:y+13},{x:x+w*.92,y:y+h-12},{x:x+w*.66,y:y+h},{x:x-w*.7,y:y+h-2},{x:x-w,y:y+h-15},{x:x-w*.95,y:y+12}];
 if(shell>0){
  g.fillStyle(0x7ddcff,.24*shell);g.fillPoints(poly,true);g.lineStyle(3,0x9cecff,.85*shell);g.strokePoints(poly,true);
  g.fillStyle(0xe0fbff,.24*shell);g.fillPoints([poly[0],poly[7],poly[6],{x:x-w*.48,y:y+h*.83},{x:x-w*.42,y:y+16}],true);
  g.fillStyle(0x32a5ee,.30*shell);g.fillPoints([poly[2],poly[3],poly[4],{x:x+w*.42,y:y+h*.83},{x:x+w*.5,y:y+16}],true);
  g.lineStyle(1.2,0xf3ffff,.82*shell);g.beginPath();g.moveTo(x-w*.75,y+5);g.lineTo(x+w*.5,y+3);g.lineTo(x+w*.85,y+16);g.moveTo(x-w*.72,y+h-10);g.lineTo(x-w*.46,y+h-3);g.lineTo(x+w*.54,y+h-4);g.strokePath();
  // Frost and internal fractures stay translucent so the puzzle information remains visible.
  g.lineStyle(1.4,0xeaffff,.60*shell);g.beginPath();g.moveTo(x-w*.8,y+h*.24);g.lineTo(x-w*.15,y+h*.34);g.lineTo(x-w*.36,y+h*.47);g.moveTo(x+w*.8,y+h*.65);g.lineTo(x+w*.18,y+h*.55);g.lineTo(x+w*.32,y+h*.43);g.strokePath();
  const cy=y+h*.52,s=Math.min(13,r.w*.28);g.lineStyle(2,0xe5fcff,.88*shell);
  for(let i=0;i<6;i++){const a=i*Math.PI/3,dx=Math.cos(a),dy=Math.sin(a);g.lineBetween(x,cy,x+dx*s,cy+dy*s);for(const turn of [-.65,.65])g.lineBetween(x+dx*s*.58,cy+dy*s*.58,x+dx*s*.58-Math.cos(a+turn)*s*.32,cy+dy*s*.58-Math.sin(a+turn)*s*.32);}
  if(age>=0){g.lineStyle(2,0xffffff,shell);g.beginPath();g.moveTo(x-w*.6,y);g.lineTo(x+w*.1,y+h*.22);g.lineTo(x-w*.2,y+h*.5);g.lineTo(x+w*.3,y+h*.72);g.lineTo(x-w*.1,y+h);g.strokePath();}
 }
 if(age<0||reduced||p>=1)return;
 const fade=(1-p)**1.5;
 for(let i=0;i<12;i++){
  const side=i%2?1:-1,originY=y+h*(.12+Math.floor(i/2)*.15),dx=side*(8+(i%3)*8)*p,dy=-Math.sin(p*Math.PI)*(12+i%4*5)+p*p*22,cx=x+side*w*.6+dx,cy=originY+dy,size=(4+i%3*2)*(1-p*.25),a=i*.7+p*side*1.4;
  const points=Array.from({length:4},(_,j)=>{const t=a+j*Math.PI/2;return {x:cx+Math.cos(t)*size,y:cy+Math.sin(t)*size*.7};});
  g.fillStyle(i%3?0x8cdef7:0xe7ffff,.80*fade);g.fillPoints(points,true);g.lineStyle(1,0xffffff,.7*fade);g.strokePoints(points,true);
 }
}
