import Phaser from 'phaser';
import { type Board, type Move, completeTube, moveFor } from '../core/rules';
import { area, clip, layout, surface, type Point } from './geometry';
export const COLORS=[0x53c7dc,0xf3ac55,0xc489e8,0x79c7a2,0xee7186,0x718eea,0xd5da72,0xdfa98d];
const SIGNS=['●','▲','◆','✚','♥','★','■','✦'];
type Pose={x:number;y:number;w:number;h:number};
type Flight={from:number;to:number;color:number;amount:number;before:Board;start:number;duration:number};
export class WaterScene extends Phaser.Scene {
  private ink!:Phaser.GameObjects.Graphics;
  private labels:Phaser.GameObjects.Text[]=[];
  slots=5;board:Board=[];selected:number|null=null;hintMove:Move|null=null;symbols=false;light=false;
  private flight?:Flight;
  private selectionY=new Map<number,number>();
  private pulses=new Map<number,number>();
  onTap:(i:number|null)=>void=()=>{};
  onPour:()=>void=()=>{};
  onComplete:()=>void=()=>{};
  private startedSound=false;
  create(){
    this.ink=this.add.graphics();this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{
      if(!p.primaryDown)return;
      const poses=this.positions();const i=poses.findIndex((r,n)=>n<this.slots&&Math.abs(p.x-r.x)<Math.max(24,r.w*.7)&&p.y>r.y-20&&p.y<r.y+r.h+16);
      this.onTap(i<0?null:i);
    });
  }
  positions(){return layout(this.scale.width,this.scale.height,this.slots);}
  setBoard(b:Board){this.board=b;}
  animate(before:Board,m:Move,fast:boolean){this.flight={...m,before,start:performance.now(),duration:fast?300:540};this.startedSound=false;}
  get busy(){return !!this.flight;}
  busyTube(i:number){return this.flight?.from===i || this.flight?.to===i;}
  skip(){this.flight=undefined;this.startedSound=false;this.previousSignature="";}
  reject(i:number){this.pulses.set(i,performance.now());}
  private polygon(points:Point[],color:number,alpha=1){if(points.length<3||area(points)<.01)return;this.ink.fillStyle(color,alpha);this.ink.fillPoints(points,true);}
  private tube(r:Pose,layers:{color:number;amount:number}[],angle:number,selected:boolean,target:boolean,index:number,time:number){
    const g=this.ink,cos=Math.cos(angle),sin=Math.sin(angle);
    const transform=(x:number,y:number)=>({x:r.x+x*cos-y*sin,y:r.y+x*sin+y*cos});
    const w=r.w*.5, h=r.h;
    const local=[[-w,0],[w,0],[w,h-13],[w-3,h-5],[w-11,h],[-w+11,h],[-w+3,h-5],[-w,h-13]];
    const poly=local.map(([x,y])=>transform(x,y));
    const pulse=this.pulses.get(index);const shake=pulse&&time-pulse<160?Math.sin((time-pulse)/13)*2:0;
    if(shake)for(const p of poly)p.x+=shake;
    g.fillStyle(this.light?0x3b6470:0x000000,.12);g.fillEllipse(r.x,r.y+h+12,r.w*1.3,10);
    this.polygon(poly,this.light?0xffffff:0x365963,this.light?.55:.28);
    let sum=0;
    for(const layer of layers){
      if(layer.amount<=0)continue;
      const low=surface(poly,sum/4*.87),high=surface(poly,(sum+layer.amount)/4*.87);
      const band=clip(clip(poly,high,true),low,false);this.polygon(band,COLORS[layer.color]);
      if(Math.abs(angle)<.12){g.fillStyle(0xffffff,.24);g.fillEllipse(r.x,high+1,r.w-3,5);}
      if(this.symbols && layer.amount>.4 && Math.abs(angle)<.12){
        const label=this.labels.pop() ?? this.add.text(0,0,'',{fontFamily:'sans-serif',fontSize:'16px',color:'#102a30',fontStyle:'bold'}).setOrigin(.5);
        label.setPosition(r.x,(low+high)/2).setText(SIGNS[layer.color]).setVisible(true);this.activeLabels.push(label);
      }
      sum+=layer.amount;
    }
    g.lineStyle(selected?2.5:target?2:1.5,selected?0xf7e2b5:target?0x91d6b1:this.light?0x608c95:0x86abb4,selected||target?1:.65);g.strokePoints(poly,true);
    const a=transform(-w-2,0),b=transform(w+2,0);g.lineStyle(3,this.light?0x81a3a9:0xb3d4d9,.75);g.lineBetween(a.x,a.y,b.x,b.y);
    const shine1=transform(-w+5,10),shine2=transform(-w+5,h-16);g.lineStyle(3,0xffffff,.22);g.lineBetween(shine1.x,shine1.y,shine2.x,shine2.y);
    if(layers.reduce((s,l)=>s+l.amount,0)===4&&layers.every(l=>l.color===layers[0].color)&&!angle){g.fillStyle(0xade7c8,.9);g.fillCircle(r.x,r.y+h+25,3);}
    return {poly,transform};
  }
  private activeLabels:Phaser.GameObjects.Text[]=[];
  private previousSignature='';
  update(){
    if(!this.ink)return;
    const signature=JSON.stringify([this.board,this.selected,this.hintMove,this.symbols,this.light,this.scale.width,this.scale.height]);
    const settling=[...this.selectionY].some(([i,y])=>Math.abs(y-(this.selected===i||this.hintMove?.from===i?-12:0))>.1);
    const shaking=[...this.pulses.values()].some(t=>performance.now()-t<180);
    if(!this.flight&&!settling&&!shaking&&signature===this.previousSignature)return;
    this.previousSignature=signature;
    this.ink.clear();for(const l of this.activeLabels){l.setVisible(false);this.labels.push(l);}this.activeLabels=[];
    const now=performance.now(),poses=this.positions(),f=this.flight;
    if(this.slots>this.board.length){const p=poses[this.board.length];this.ink.lineStyle(1,this.light?0x63848a:0x52747b,.45);this.ink.strokeRoundedRect(p.x-p.w/2,p.y,p.w,p.h,14);this.ink.lineStyle(2,this.light?0x63848a:0x87a9ad,.65);this.ink.lineBetween(p.x-8,p.y+p.h/2,p.x+8,p.y+p.h/2);this.ink.lineBetween(p.x,p.y+p.h/2-8,p.x,p.y+p.h/2+8);}
    let t=f?Math.min(1,(now-f.start)/f.duration):0;
    const transfer=f?Phaser.Math.Clamp((t-.28)/.46,0,1):0;
    if(f&&t>=.28&&!this.startedSound){this.startedSound=true;this.onPour();}
    const layers=(tube:number[])=>tube.map(color=>({color,amount:1}));
    for(let i=0;i<this.board.length;i++){
      if(f&&i===f.from)continue;
      const r={...poses[i]};const target=this.selected!==null&&!!moveFor(this.board,this.selected,i) || this.hintMove?.to===i;
      const aim=this.selected===i||this.hintMove?.from===i?-12:0;const prev=this.selectionY.get(i)??0;const offset=Phaser.Math.Linear(prev,aim,.35);this.selectionY.set(i,offset);r.y+=offset;
      let ls=layers(f?f.before[i]:this.board[i]);
      if(f&&i===f.to)ls.push({color:f.color,amount:f.amount*transfer});
      this.tube(r,ls,0,this.selected===i||this.hintMove?.from===i,target,i,now);
    }
    if(f){
      const origin=poses[f.from],dest=poses[f.to],dir=origin.x<=dest.x?1:-1;
      const ease=(v:number)=>v*v*(3-2*v);
      const lift=t<.28?ease(t/.28):t>.74?1-ease((t-.74)/.26):1;
      const angle=dir*1.05*lift;
      // Place the lower lip over the destination; source sits clear of the receiver.
      const tipX=dir*origin.w*.5;
      const targetX=dest.x-tipX*Math.cos(angle),targetY=dest.y-30-tipX*Math.sin(angle);
      const r={...origin,x:Phaser.Math.Linear(origin.x,targetX,lift),y:Phaser.Math.Linear(origin.y,targetY,lift)};
      const ls=layers(f.before[f.from]);let remaining=f.amount*transfer;
      for(let i=ls.length-1;i>=0&&remaining>0;i--){const q=Math.min(ls[i].amount,remaining);ls[i].amount-=q;remaining-=q;}
      const {transform}=this.tube(r,ls,angle,true,false,f.from,now);
      if(t>=.28&&t<.74){
        const lip=transform(tipX,0),endY=dest.y+dest.h*(1-(f.before[f.to].length+f.amount*transfer)*.87/4);
        this.ink.lineStyle(5,COLORS[f.color],.92);this.ink.beginPath();this.ink.moveTo(lip.x,lip.y);this.ink.lineTo(dest.x,Math.max(dest.y+5,endY));this.ink.strokePath();
        this.ink.lineStyle(1,0xffffff,.4);this.ink.lineBetween(lip.x-1,lip.y,dest.x-1,Math.max(dest.y+5,endY));
        for(let n=0;n<3;n++){const phase=((now/330)+n*.33)%1;this.ink.fillStyle(COLORS[f.color],1-phase);this.ink.fillCircle(dest.x+Math.sin(n*2.4+now/100)*phase*11,endY-Math.sin(phase*Math.PI)*9,2*(1-phase));}
      }
      if(t>=1){this.flight=undefined;this.onComplete();}
    }
  }
}
