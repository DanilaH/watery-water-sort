import Phaser from 'phaser';
import { type Board, type Move, completeTube, moveFor } from '../core/rules';
import { area, clip, layout, surface, type Point } from './geometry';
export const COLORS=[0x29d8ee,0xffb631,0xb583ff,0x43df99,0xff648e,0x528cff,0xe4eb49,0xe8985c];
const SIGNS=['●','▲','◆','✚','♥','★','■','✦'];
type Pose={x:number;y:number;w:number;h:number};
type Layer={color:number;amount:number};
type Flight=Move & {before:Board;start:number;duration:number;lifted:number};
type Burst={index:number;start:number;color:number;final:boolean};
type Particle={x:number;y:number;vx:number;vy:number;life:number;age:number;color:number;size:number;spin:number};
const blend=(a:number,b:number,t:number)=>Phaser.Display.Color.GetColor(
  ((a>>16)&255)*(1-t)+((b>>16)&255)*t,((a>>8)&255)*(1-t)+((b>>8)&255)*t,(a&255)*(1-t)+(b&255)*t);
function clipX(poly:Point[],x:number,right:boolean):Point[]{return clip(poly.map(p=>({x:p.y,y:p.x})),x,right).map(p=>({x:p.y,y:p.x}));}
function grouped(tube:number[]):Layer[]{const out:Layer[]=[];for(const color of tube){const prev=out.at(-1);if(prev?.color===color)prev.amount++;else out.push({color,amount:1});}return out;}
export class WaterScene extends Phaser.Scene {
  private ink!:Phaser.GameObjects.Graphics;
  private fx!:Phaser.GameObjects.Graphics;
  private labels:Phaser.GameObjects.Text[]=[];
  private activeLabels:Phaser.GameObjects.Text[]=[];
  private floatLabels:Phaser.GameObjects.Text[]=[];
  slots=5;board:Board=[];selected:number|null=null;hintMove:Move|null=null;symbols=false;light=false;
  private flight?:Flight;
  private selectionY=new Map<number,number>();
  private selectionV=new Map<number,number>();
  private pulses=new Map<number,number>();
  private settles=new Map<number,number>();
  private bursts:Burst[]=[];
  private particles:Particle[]=[];
  private startedSound=false;
  private previousSignature='';
  private lastFrame=0;
  onTap:(i:number|null)=>void=()=>{};
  onPour:()=>void=()=>{};
  onComplete:()=>void=()=>{};
  create(){
    this.ink=this.add.graphics();this.fx=this.add.graphics().setDepth(4);
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{
      if(!p.primaryDown)return;
      const poses=this.positions();const i=poses.findIndex((r,n)=>n<this.slots&&Math.abs(p.x-r.x)<Math.max(24,r.w*.71)&&p.y>r.y-22&&p.y<r.y+r.h+15);
      this.onTap(i<0?null:i);
    });
  }
  positions(){return layout(this.scale.width,this.scale.height,this.slots);}
  setBoard(b:Board){this.board=b;}
  animate(before:Board,m:Move,fast:boolean){this.flight={...m,before,start:performance.now(),duration:fast?320:560,lifted:this.selectionY.get(m.from)??0};this.startedSound=false;this.selectionY.set(m.from,0);this.selectionV.set(m.from,0);}
  get busy(){return !!this.flight;}
  busyTube(i:number){return this.flight?.from===i||this.flight?.to===i;}
  skip(){this.flight=undefined;this.startedSound=false;this.previousSignature='';}
  resetEffects(){this.skip();this.bursts=[];this.particles=[];this.settles.clear();this.pulses.clear();this.selectionY.clear();this.selectionV.clear();for(const l of this.floatLabels)l.destroy();this.floatLabels=[];}
  reject(i:number){this.pulses.set(i,performance.now());}
  land(i:number){this.settles.set(i,performance.now());}
  celebrate(index:number,final=false){
    const r=this.positions()[index];if(!r)return;
    const color=COLORS[this.board[index]?.[0]??0],now=performance.now();this.bursts.push({index,start:now,color,final});
    for(let n=0;n<(final?28:18);n++){
      const theta=Math.PI*2*n/(final?28:18),speed=35+Math.random()*90;
      this.particles.push({x:r.x,y:r.y+r.h*.43,vx:Math.cos(theta)*speed,vy:Math.sin(theta)*speed-60,age:0,life:.45+Math.random()*.4,color:n%3?color:0xfff0bc,size:2+Math.random()*2,spin:Math.random()*6});
    }
    this.particles=this.particles.slice(-100);
    if(!final){const label=this.add.text(r.x,r.y-12,'Цвет собран',{fontFamily:'system-ui, sans-serif',fontSize:'12px',fontStyle:'bold',color:this.light?'#23526a':'#fff0cb',stroke:this.light?'#ffffff':'#171a3b',strokeThickness:3}).setOrigin(.5).setDepth(6);this.floatLabels.push(label);this.tweens.add({targets:label,y:r.y-35,alpha:0,duration:650,ease:'Cubic.Out',onComplete:()=>{this.floatLabels=this.floatLabels.filter(l=>l!==label);label.destroy();}});}
  }
  private polygon(points:Point[],color:number,alpha=1,g=this.ink){if(points.length<3||area(points)<.005)return;g.fillStyle(color,alpha);g.fillPoints(points,true);}
  private star(x:number,y:number,r:number,color:number,alpha:number,rotation=0){const g=this.fx;g.fillStyle(color,alpha);g.beginPath();for(let n=0;n<8;n++){const a=rotation+n*Math.PI/4,s=n%2?r*.26:r;const px=x+Math.cos(a)*s,py=y+Math.sin(a)*s;if(n===0)g.moveTo(px,py);else g.lineTo(px,py);}g.closePath();g.fillPath();}
  private tube(r:Pose,layers:Layer[],angle:number,selected:boolean,target:boolean,index:number,now:number){
    const g=this.ink,w=r.w*.5,h=r.h;
    const settle=this.settles.get(index),age=settle===undefined?10000:now-settle;
    const landing=age<400?Math.sin(age/30)*Math.exp(-age/90):0;
    const squash=1+landing*.035;
    const pulse=this.pulses.get(index),rejectAge=pulse===undefined?10000:now-pulse;
    const shake=rejectAge<200?Math.sin(rejectAge/13)*4*Math.exp(-rejectAge/85):0;
    const c=Math.cos(angle),s=Math.sin(angle);
    const transform=(x:number,y:number)=>({x:r.x+shake+x*c*squash-y*s/squash,y:r.y+x*s*squash+y*c/squash});
    const radius=Math.min(w,18),local:Point[]=[{x:-w,y:0},{x:w,y:0},{x:w,y:h-radius}];
    for(let n=1;n<=8;n++){const a=n*Math.PI/16;local.push({x:w-radius+Math.cos(a)*radius,y:h-radius+Math.sin(a)*radius});}
    local.push({x:-w+radius,y:h});
    for(let n=1;n<=8;n++){const a=Math.PI/2+n*Math.PI/16;local.push({x:-w+radius+Math.cos(a)*radius,y:h-radius+Math.sin(a)*radius});}
    const poly=local.map(p=>transform(p.x,p.y));
    // A soft elliptical contact shadow anchors the bottle while the lifted one floats.
    const shadowY=r.y+h+12;for(let n=3;n>=1;n--){g.fillStyle(this.light?0x385d73:0x070a1f,.06);g.fillEllipse(r.x,shadowY,r.w*(1+n*.24),5+n*3);}
    if(selected||target){const glow=selected?0x8de7ff:0x87bfe7;for(let n=3;n>=1;n--){g.lineStyle(n*5,glow,.025);g.strokePoints(poly,true);}g.fillStyle(glow,.12);g.fillEllipse(r.x,shadowY,r.w*1.25,12);}
    this.polygon(poly,this.light?0xa0bddb:0x809dd1,this.light?.12:.07);
    const total=layers.reduce((v,l)=>v+l.amount,0);let sum=0;
    const bounds={lo:Math.min(...poly.map(p=>p.x)),hi:Math.max(...poly.map(p=>p.x))};
    for(let n=0;n<layers.length;n++){
      const layer=layers[n];if(layer.amount<.001)continue;
      const low=surface(poly,sum/4*.87),high=surface(poly,(sum+layer.amount)/4*.87),base=COLORS[layer.color];
      const band=clip(clip(poly,high,true),low,false);
      // Cross-section shading is clipped to the actual liquid, including on a tilted vessel.
      for(let k=0;k<28;k++){
        const t=(k+.5)/28,x0=Phaser.Math.Linear(bounds.lo,bounds.hi,k/28),x1=Phaser.Math.Linear(bounds.lo,bounds.hi,(k+1)/28)+.8;
        let col=blend(base,0x0b2353,.36*Math.pow(Math.abs(t-.4)*1.8,1.4));
        col=blend(col,0xffffff,Math.exp(-Math.pow((t-.22)/.15,2))*.28);
        this.polygon(clipX(clipX(band,x0,true),x1,false),col);
      }
      if(Math.abs(angle)<.09){
        const wave=(age<650?Math.sin(now/43+index)*2.1*Math.exp(-age/210):0)+(selected?Math.sin(now/135)*.9:0);
        const cap=clip(poly,high+3,true);const left=cap.length?Math.min(...cap.map(p=>p.x)):r.x-w,right=cap.length?Math.max(...cap.map(p=>p.x)):r.x+w;
        g.fillStyle(blend(base,0xffffff,.25),.82);g.fillEllipse((left+right)/2,high+.7,(right-left)-1,Math.max(3,r.w*.105));
        g.lineStyle(1.2,0xffffff,.28);g.beginPath();for(let k=0;k<=14;k++){const x=left+(right-left)*k/14,y=high+Math.sin(k/14*Math.PI*2)*wave;if(k===0)g.moveTo(x,y);else g.lineTo(x,y);}g.strokePath();
        if(n===layers.length-1&&age<280){const p=age/280;g.lineStyle(1.2,0xffffff,.55*(1-p));g.strokeEllipse(r.x,high+2,r.w*.8*p,4+3*p);}
      }
      if(this.symbols&&layer.amount>.35&&Math.abs(angle)<.1){const label=this.labels.pop()??this.add.text(0,0,'',{fontFamily:'sans-serif',fontSize:'15px',color:'#18294a',fontStyle:'bold'}).setOrigin(.5).setDepth(3);label.setPosition(r.x,(low+high)/2).setText(SIGNS[layer.color]).setVisible(true);this.activeLabels.push(label);}
      sum+=layer.amount;
    }
    // Thick glass edges, a rim ellipse and asymmetric specular reflections.
    g.lineStyle(4.5,this.light?0x6f91ae:0xc4d7ff,this.light?.22:.14);g.strokePoints(poly,true);
    g.lineStyle(1.15,this.light?0x607e9f:0xc9dcff,.64);g.strokePoints(poly,true);
    const rimA=transform(-w-1,0),rimB=transform(w+1,0);
    g.lineStyle(5,this.light?0xd6e7f4:0x6b82a9,.72);g.lineBetween(rimA.x,rimA.y,rimB.x,rimB.y);
    g.lineStyle(1.3,0xf7fbff,.95);g.lineBetween(rimA.x,rimA.y-1,rimB.x,rimB.y-1);
    for(const [x,alpha,thick,y1,y2]of [[-w+5,.72,3,10,h*.54],[-w+5,.23,2,h*.61,h-15],[w-4,.21,2,9,h-18]] as number[][]){const a=transform(x,y1),b=transform(x,y2);g.lineStyle(thick,0xffffff,alpha);g.lineBetween(a.x,a.y,b.x,b.y);}
    const bottomA=transform(-w+radius*.6,h-3),bottomB=transform(w-radius*.6,h-3);g.lineStyle(2,0xe2ecff,.38);g.lineBetween(bottomA.x,bottomA.y,bottomB.x,bottomB.y);
    const uniform=total===4&&layers.every(l=>l.color===layers[0].color);
    if(uniform&&!angle){
      const base=COLORS[layers[0].color];g.fillStyle(base,.12);g.fillEllipse(r.x,shadowY+2,r.w*1.4,13);
      g.lineStyle(2,base,.8);g.strokeEllipse(r.x,r.y+h+22,22,18);g.lineStyle(2,this.light?0x273b58:0xf4f6ff,.95);g.beginPath();g.moveTo(r.x-4,r.y+h+22);g.lineTo(r.x-1,r.y+h+25);g.lineTo(r.x+5,r.y+h+19);g.strokePath();
    }
    return {poly,transform};
  }
  update(){
    if(!this.ink)return;
    const now=performance.now(),dt=Math.min(.035,(now-this.lastFrame)/1000||.016);this.lastFrame=now;
    const signature=JSON.stringify([this.board,this.selected,this.hintMove,this.symbols,this.light,this.scale.width,this.scale.height]);
    const settling=[...this.selectionY].some(([i,y])=>Math.abs(y-(this.selected===i||this.hintMove?.from===i?-17:0))>.1);
    const activeSettle=[...this.settles.values()].some(t=>now-t<650),shaking=[...this.pulses.values()].some(t=>now-t<220);
    if(!this.flight&&!settling&&!shaking&&!activeSettle&&!this.bursts.length&&!this.particles.length&&this.selected===null&&this.hintMove===null&&signature===this.previousSignature)return;
    this.previousSignature=signature;this.ink.clear();this.fx.clear();for(const l of this.activeLabels){l.setVisible(false);this.labels.push(l);}this.activeLabels=[];
    const poses=this.positions(),f=this.flight;
    if(this.slots>this.board.length){const r=poses[this.board.length],g=this.ink;g.fillStyle(this.light?0x597597:0x90a8db,.025);g.fillRoundedRect(r.x-r.w/2,r.y+5,r.w,r.h-5,18);g.lineStyle(1,this.light?0x6787a3:0x879bc7,.22);g.strokeRoundedRect(r.x-r.w/2,r.y+5,r.w,r.h-5,18);g.lineStyle(2,this.light?0x6787a3:0x879bc7,.4);g.lineBetween(r.x-6,r.y+r.h*.52,r.x+6,r.y+r.h*.52);g.lineBetween(r.x,r.y+r.h*.52-6,r.x,r.y+r.h*.52+6);}
    const t=f?Math.min(1,(now-f.start)/f.duration):0,transfer=f?Phaser.Math.Clamp((t-.25)/.48,0,1):0;
    if(f&&t>=.25&&!this.startedSound){this.startedSound=true;this.onPour();}
    for(let i=0;i<this.board.length;i++){
      if(f&&i===f.from)continue;
      const r={...poses[i]},chosen=this.selected===i||this.hintMove?.from===i;
      const target=this.selected!==null&&!!moveFor(this.board,this.selected,i)||this.hintMove?.to===i;
      const aim=chosen?-17:0,prev=this.selectionY.get(i)??0;let velocity=this.selectionV.get(i)??0;velocity+=((aim-prev)*520-velocity*28)*dt;let offset=prev+velocity*dt;if(Math.abs(offset-aim)<.04&&Math.abs(velocity)<.2){offset=aim;velocity=0;}this.selectionY.set(i,offset);this.selectionV.set(i,velocity);r.y+=offset;
      const angle=chosen?Math.sin(now/190)*.018:0;
      let ls=grouped(f?f.before[i]:this.board[i]);
      if(f&&i===f.to){const last=ls.at(-1);if(last?.color===f.color)last.amount+=f.amount*transfer;else ls.push({color:f.color,amount:f.amount*transfer});this.settles.set(i,now);}
      this.tube(r,ls,angle,chosen,target,i,now);
      if(target){const pulse=.6+.4*Math.sin(now/160);this.fx.lineStyle(1.4,0xacd9ff,.3+.3*pulse);this.fx.strokeEllipse(r.x,r.y+r.h+13,r.w*1.3,13);}
    }
    if(f){
      const origin=poses[f.from],dest=poses[f.to],dir=origin.x<=dest.x?1:-1;
      const ease=(v:number)=>1-Math.pow(1-v,3);
      const travel=t<.25?ease(t/.25):t>.73?1-ease((t-.73)/.27):1;
      const angle=dir*1.16*travel,tipX=dir*origin.w*.5;
      const targetX=dest.x-tipX*Math.cos(angle),targetY=dest.y-23-tipX*Math.sin(angle);
      const arc=-Math.sin(Math.PI*travel)*Math.min(28,origin.h*.2);
      const r={...origin,x:Phaser.Math.Linear(origin.x,targetX,travel),y:Phaser.Math.Linear(origin.y+f.lifted,targetY,travel)+arc};
      const ls=grouped(f.before[f.from]);let remaining=f.amount*transfer;for(let i=ls.length-1;i>=0&&remaining>0;i--){const q=Math.min(ls[i].amount,remaining);ls[i].amount-=q;remaining-=q;}
      const {transform}=this.tube(r,ls,angle,true,false,f.from,now);
      if(t>=.25&&t<.73){
        const lip=transform(tipX,0),endY=dest.y+dest.h*(1-(f.before[f.to].length+f.amount*transfer)*.87/4),color=COLORS[f.color];
        const stream:Point[]=[];for(let k=0;k<=18;k++){const v=k/18;stream.push({x:Phaser.Math.Linear(lip.x,dest.x,v)+Math.sin(v*Math.PI)*Math.sin(now/60)*1.1,y:Phaser.Math.Linear(lip.y,Math.max(dest.y+5,endY),v)});}
        for(const [width,alpha,col]of [[12,.08,color],[7,.95,color],[2,.68,0xffffff]]){this.fx.lineStyle(width,col,alpha);this.fx.strokePoints(stream,false);}
        for(let n=0;n<5;n++){const phase=((now/260)+n*.2)%1;this.fx.fillStyle(blend(color,0xffffff,.3),1-phase);this.fx.fillEllipse(dest.x+Math.sin(n*2.4+now/120)*phase*14,endY-Math.sin(phase*Math.PI)*13,2.5*(1-phase)+1,4*(1-phase)+1);}
        this.fx.lineStyle(1.5,0xffffff,.45);this.fx.strokeEllipse(dest.x,endY+2,9+Math.sin(now/40)*4,3);
      }
      if(t>=1){this.flight=undefined;this.land(f.from);this.land(f.to);this.onComplete();}
    }
    this.bursts=this.bursts.filter(b=>now-b.start<650);
    for(const b of this.bursts){const r=poses[b.index],p=(now-b.start)/650,fade=Math.pow(1-p,1.7),g=this.fx;
      for(let n=3;n>=1;n--){g.fillStyle(b.color,.035*fade);g.fillEllipse(r.x,r.y+r.h*.5,r.w*(1+n*.6),r.h*(1+n*.1));}
      g.lineStyle(2,b.color,.8*fade);g.strokeEllipse(r.x,r.y+r.h*.45,r.w*(.9+p*2.2),r.h*(.35+p*.6));
      const sweep=r.y+r.h*(1-p);g.lineStyle(3,0xffffff,.75*fade);g.lineBetween(r.x-r.w*.4,sweep,r.x+r.w*.4,sweep);
      for(let n=0;n<4;n++){const a=n*Math.PI/2+p*.8;this.star(r.x+Math.cos(a)*r.w*(.6+p*.6),r.y+r.h*.35+Math.sin(a)*r.h*.35,5*fade,b.color,fade,a);}
    }
    this.particles=this.particles.filter(p=>p.age<p.life);
    for(const p of this.particles){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=165*dt;const fade=Math.max(0,1-p.age/p.life);this.star(p.x,p.y,p.size*fade,p.color,fade,p.spin+p.age*2);}
  }
}
