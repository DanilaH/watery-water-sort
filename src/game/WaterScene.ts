import Phaser from 'phaser';
import type {KnowledgeView} from '../core/knowledge';
import {drawIce} from './Ice';
import {VictoryOverlay} from './VictoryOverlay';
import {GlassMaterial} from './GlassMaterial';
import {liquidMesh,liquidContour,boundaryY,cutBoundary} from './liquidSurface';
import {stepLiquid,smooth,streamEnvelope,completionCork,FILL_BEATS,type LiquidMotion} from './liquid';
import { type Board, type Move, type Goals, goalAt, goalList, miniIndex, isMini, iceIndex, isFrozen, capacityAt, sealedTube, moveFor } from '../core/rules';
import { area, clip, layout, goalLayout, miniLayout, surface, planPour, pourPose, vesselPolygon, LIQUID_FILL, pourTransfer, pourTiming, pourFrame, type PourPlan, type Point } from './geometry';
// Clean candy hues: amber/yellow-green and cyan/royal blue stay separate at small sizes.
export const COLORS=[0x00d9f5,0xffd000,0xad32ff,0x16df64,0xff2447,0x2463ff,0xbcef00,0xff7e14];
const SIGNS=['●','▲','◆','✚','♥','★','■','✦'];
type Pose={x:number;y:number;w:number;h:number};
type Layer={color:number;amount:number;reveal?:number};
type Flight=Move & {before:Board;ids?:number[][];start:number;duration:number;timing:ReturnType<typeof pourTiming>;received:boolean;lifted:number;plan:PourPlan};
type Burst={index:number;start:number;color:number;final:boolean;sealed?:boolean;phase?:number;fired?:boolean;order?:number;heavy?:boolean};
type SymbolMark={x:number;y:number;text:string;size:number;colour?:string};
type TubeCache={key:string;commands:number[];poly:Point[];symbols:SymbolMark[];cork:boolean};
type Particle={x:number;y:number;vx:number;vy:number;life:number;age:number;color:number;size:number;spin:number};
const blend=(a:number,b:number,t:number)=>Phaser.Display.Color.GetColor(
  ((a>>16)&255)*(1-t)+((b>>16)&255)*t,((a>>8)&255)*(1-t)+((b>>8)&255)*t,(a&255)*(1-t)+(b&255)*t);
function clipX(poly:Point[],x:number,right:boolean):Point[]{return clip(poly.map(p=>({x:p.y,y:p.x})),x,right).map(p=>({x:p.y,y:p.x}));}
function grouped(tube:number[]):Layer[]{const out:Layer[]=[];for(const color of tube){const prev=out.at(-1);if(prev?.color===color)prev.amount++;else out.push({color,amount:1});}return out;}
export class WaterScene extends Phaser.Scene {
  private layoutKey='';
  private layoutCache:ReturnType<typeof layout>=[];
  private tubes=new Map<number,TubeCache>();
  private root!:Phaser.GameObjects.Container;
  private viewWidth=1;private viewHeight=1;private density=1;private entrance=0;
  private ink!:Phaser.GameObjects.Graphics;
  private flyingInk!:Phaser.GameObjects.Graphics;
  private fx!:Phaser.GameObjects.Graphics;
  private glass?:GlassMaterial;
  private crystalBase?:Phaser.GameObjects.Image;
  private crystalShards:Phaser.GameObjects.Image[]=[];
  private secondCrystalBase?:Phaser.GameObjects.Image;
  private secondCrystalShards:Phaser.GameObjects.Image[]=[];
  private labels:Phaser.GameObjects.Text[]=[];
  private activeLabels:Phaser.GameObjects.Text[]=[];
  private floatLabels:Phaser.GameObjects.Text[]=[];
  private queueLabels:Phaser.GameObjects.Text[]=[];
  iceHeld:number|null=null;private iceRelease?:{index:number;start:number};
  frozen(i:number){return isFrozen(this.goal,i)||this.iceHeld===i;}
  thaw(index:number){this.iceHeld=null;this.iceRelease={index,start:performance.now()};this.land(index,2);this.bodyImpulse(index,30);this.previousSignature='';}
  goal?:Goals;lockedExtra=false;slots=5;board:Board=[];selected:number|null=null;hintMove:Move|null=null;queuedMove:Move|null=null;symbols=false;light=false;reduced=false;
  private knowledge?:KnowledgeView;
  private known=new Set<number>();
  private reveals=new Map<number,number>();
  setKnowledge(view?:KnowledgeView){
    if(view?.level!==this.knowledge?.level){this.reveals.clear();this.known.clear();}
    else if(view)for(const id of view.known)if(!this.known.has(id))this.reveals.set(id,this.flight?this.flight.start+this.flight.timing.lift+this.flight.timing.flow:performance.now());
    this.knowledge=view;this.known=new Set(view?.known??[]);
  }
  private layers(tube:number[],ids:number[]|undefined,now:number):Layer[]{
    if(!ids||!this.knowledge)return grouped(tube);
    const out:Layer[]=[];
    tube.forEach((color,d)=>{const id=ids[d],start=this.reveals.get(id),reveal=!this.known.has(id)?0:start===undefined?1:this.reduced?Number(now>=start):smooth((now-start)/280),previous=out.at(-1);
      if(reveal===1&&previous?.color===color&&previous.reveal===1)previous.amount++;
      else out.push({color,amount:1,reveal});
    });return out;
  }
  private flight?:Flight;
  private selectionY=new Map<number,number>();
  private hitPolygons=new Map<number,Point[]>();
  private corkOpen=new Map<number,number>();
  private selectionV=new Map<number,number>();
  private pulses=new Map<number,number>();
  private settles=new Map<number,number>();
  private impulses=new Map<number,number>();
  private liquid=new Map<number,LiquidMotion>();
  private bodyMotion=new Map<number,LiquidMotion>();
  private bursts:Burst[]=[];
  private particles:Particle[]=[];
  private startedSound=false;
  private popped=new Set<number>();
  private overlay=new VictoryOverlay();
  private lastSelected:number|null=null;
  private previousSignature='';
  private lastFrame=0;private frameStep=.016;
  onTap:(i:number|null)=>void=()=>{};
  onPour:(remainingMs:number,fill:number,endFill:number)=>void=()=>{};
  onComplete:()=>void=()=>{};
  onReceive:()=>void=()=>{};
  onSeal:()=>void=()=>{};
  onPhase:(phase:number,heavy:boolean)=>void=()=>{};
  onFinale:(order:number,heavy:boolean)=>void=()=>{};
  preload(){
    this.load.image('tube-glass-27','art/glass/tube-27.webp');
    this.load.image('tube-cork-27','art/glass/cork-27.webp');
    for(let i=0;i<6;i++)this.load.image(`splash-${i}`,`art/vfx/splash-${i}.webp`);
    this.load.image('goal-crystal-base','art/goal-crystal-base.webp');
    for(let i=0;i<5;i++)this.load.image(`goal-crystal-shard-${i}`,`art/goal-crystal-shard-${i}.webp`);
  }
  create(){
    this.overlay.setSprites(Array.from({length:6},(_,i)=>this.textures.get(`splash-${i}`).getSourceImage() as HTMLImageElement),COLORS);
    this.root=this.add.container(0,0).setScale(this.density);
    this.ink=this.add.graphics();this.flyingInk=this.add.graphics().setDepth(1.5);this.fx=this.add.graphics().setDepth(4);this.root.add([this.ink,this.flyingInk,this.fx]);
    this.glass=new GlassMaterial(this,this.root);
    this.queueLabels=['2','↓'].map(text=>{const label=this.add.text(0,0,text,{fontFamily:'sans-serif',fontSize:'13px',fontStyle:'bold',color:'#402d19'}).setOrigin(.5).setDepth(6).setResolution(this.density).setVisible(false);this.root.add(label);return label;});this.root.sort('depth');
    this.crystalBase=this.add.image(0,0,'goal-crystal-base').setOrigin(.5,.45).setDepth(-1).setVisible(false);this.root.add(this.crystalBase);
    this.crystalShards=Array.from({length:5},(_,i)=>{const shard=this.add.image(0,0,`goal-crystal-shard-${i}`).setOrigin(.5,.45).setDepth(-1).setVisible(false);this.root.add(shard);return shard;});this.root.sort('depth');
    this.secondCrystalBase=this.add.image(0,0,'goal-crystal-base').setOrigin(.5,.45).setDepth(-1).setVisible(false);this.root.add(this.secondCrystalBase);
    this.secondCrystalShards=Array.from({length:5},(_,i)=>{const shard=this.add.image(0,0,`goal-crystal-shard-${i}`).setOrigin(.5,.45).setDepth(-1).setVisible(false);this.root.add(shard);return shard;});this.root.sort('depth');
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{
      if(!p.primaryDown)return;
      this.onTap(this.hitTube(p.x/this.density,p.y/this.density));
    });
  }
  private hitTube(x:number,y:number):number|null{
    // Marks belong to their slots. Keep resting slots usable during a flight.
    const poses=this.positions(),source=this.queuedMove?.from??(this.flight?this.selected:null);
    for(const index of [source,this.queuedMove?.to??null]){
      if(index!==null&&poses[index]&&Math.hypot(x-poses[index].x,y-(poses[index].y-15))<=14)return index;
    }
    const slot=poses.findIndex(r=>Math.abs(x-r.x)<r.hitW/2&&Math.abs(y-(r.hitY??r.y+r.h/2))<r.hitH/2);
    if(slot>=0)return slot;
    for(const [index,poly]of [...this.hitPolygons].reverse()){
      let inside=false;
      for(let i=0,j=poly.length-1;i<poly.length;j=i++){
        const a=poly[i],b=poly[j];
        if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
      }
      if(inside)return index;
    }
    return null;
  }
  setViewport(width:number,height:number,density:number){this.viewWidth=Math.max(1,width);this.viewHeight=Math.max(1,height);this.density=density;this.root?.setScale(density);for(const label of [...this.labels,...this.activeLabels,...this.queueLabels])label.setResolution(density);this.previousSignature='';this.tubes.clear();}
  positions(){const key=`${this.viewWidth}:${this.viewHeight}:${this.slots}:${goalList(this.goal).map(g=>g.index).join(',')}:${miniIndex(this.goal)??-1}`;if(key!==this.layoutKey){this.layoutKey=key;this.layoutCache=miniLayout(goalList(this.goal).length?goalLayout(this.viewWidth,this.viewHeight,this.slots,goalList(this.goal).map(g=>g.index)):layout(this.viewWidth,this.viewHeight,this.slots),miniIndex(this.goal));}return this.layoutCache;}
  reveal(){this.entrance=performance.now();this.previousSignature='';}
  setBoard(b:Board){this.board=b;}
  animate(before:Board,m:Move,fast:boolean,view?:KnowledgeView){this.flight={...m,before,ids:view?.ids,start:performance.now(),duration:pourTiming(m.amount,fast).duration,timing:pourTiming(m.amount,fast),received:false,lifted:(this.selectionY.get(m.from)??0)+12*Math.max(0,1-(performance.now()-this.entrance)/240)**2,plan:planPour(this.positions()[m.from],this.positions()[m.to],this.viewWidth,this.viewHeight,before[m.from].length*4/capacityAt(this.goal,m.from),(before[m.from].length-m.amount)*4/capacityAt(this.goal,m.from))};this.startedSound=false;this.selectionY.set(m.from,0);this.selectionV.set(m.from,0);this.selectionY.set(m.to,0);this.selectionV.set(m.to,0);}
  get busy(){return !!this.flight;}
  busyTube(i:number){return this.flight?.from===i||this.flight?.to===i;}
  skip(){this.flight=undefined;this.startedSound=false;this.previousSignature='';}
  resetEffects(){this.reveals.clear();this.iceHeld=null;this.iceRelease=undefined;this.glass?.reset();this.crystalBase?.setVisible(false);this.crystalShards.forEach(s=>s.setVisible(false));this.secondCrystalBase?.setVisible(false);this.secondCrystalShards.forEach(s=>s.setVisible(false));this.overlay.clear();this.popped.clear();this.lastSelected=null;this.skip();this.tubes.clear();this.hitPolygons.clear();this.corkOpen.clear();for(const l of this.queueLabels)l.setVisible(false);this.bursts=[];this.particles=[];this.settles.clear();this.impulses.clear();this.liquid.clear();this.bodyMotion.clear();this.pulses.clear();this.selectionY.clear();this.selectionV.clear();this.entrance=0;this.ink?.clear();this.flyingInk?.clear();this.fx?.clear();for(const l of this.floatLabels){this.tweens.killTweensOf(l);l.destroy();}this.floatLabels=[];}
  reject(i:number){this.pulses.set(i,performance.now());}
  land(i:number,amount=1){this.settles.set(i,performance.now());this.impulses.set(i,.55+amount*.16);if(!this.reduced){const s=this.liquid.get(i)??{x:0,v:0};s.v=Math.min(120,s.v+(34+amount*14)*(!!goalAt(this.goal,i)?1.18:1));this.liquid.set(i,s);}}
  celebrate(index:number,final=false){
    const r=this.positions()[index];if(!r)return;
    const color=COLORS[this.board[index]?.[0]??0],now=performance.now();this.corkOpen.set(index,0);
    if(final){
      // Other bottles begin while the receiver seals. Its own pop follows its third beat.
      const order=this.board.map((_,i)=>i).filter(i=>i!==index&&sealedTube(this.board,i,this.goal)).sort((a,b)=>this.positions()[a].y-this.positions()[b].y||this.positions()[a].x-this.positions()[b].x);order.push(index);
      order.forEach((i,n)=>this.bursts.push({index:i,start:now+Math.max(i===index?620:0,220+n*150),color:COLORS[this.board[i][0]],final:true,order:n,heavy:!!goalAt(this.goal,i)}));
      return;
    }
    const heavy=!!goalAt(this.goal,index);this.bursts.push({index,start:now,color,final,phase:0,heavy});
    this.onPhase(0,heavy);this.bodyImpulse(index,42);this.fillSplash(index,0);
  }
  private bodyImpulse(index:number,velocity:number){
    if(this.reduced)return;const s=this.bodyMotion.get(index)??{x:0,v:0};s.v=Math.max(-90,Math.min(90,s.v+velocity*(!!goalAt(this.goal,index)?1.35:1)));this.bodyMotion.set(index,s);
  }
  private fillSplash(index:number,phase:number){
    if(this.reduced)return;const r=this.positions()[index],heavy=!!goalAt(this.goal,index),color=COLORS[this.board[index]?.[0]??0],count=phase===0?(heavy?14:6):(heavy?7:3),stretch=1+(heavy?.04:.027)*Math.tanh((this.bodyMotion.get(index)?.x??0)/1.5),localY=phase===0?surface(vesselPolygon(r.w,r.h),LIQUID_FILL):2,y=r.y+r.h+(localY-r.h)/stretch;
    for(let n=0;n<count;n++){const direction=(n-(count-1)/2)/Math.max(1,(count-1)/2);this.particles.push({x:r.x+direction*r.w*.12,y,vx:direction*(phase===0?32:24),vy:-(phase===0?65:42)*(heavy?1.25:1)*(1-Math.abs(direction)*.25),age:0,life:phase===0?.36:.25,color,size:(phase===0?2.1:1.6)*(heavy?1.35:1),spin:0});}
    this.particles=this.particles.slice(-100);
  }
  private polygon(points:Point[],color:number,alpha=1,g=this.ink){if(points.length<3||area(points)<.005)return;g.fillStyle(color,alpha);g.fillPoints(points,true);}
  private star(x:number,y:number,r:number,color:number,alpha:number,rotation=0){const g=this.fx;g.fillStyle(color,alpha);g.beginPath();for(let n=0;n<8;n++){const a=rotation+n*Math.PI/4,s=n%2?r*.26:r;const px=x+Math.cos(a)*s,py=y+Math.sin(a)*s;if(n===0)g.moveTo(px,py);else g.lineTo(px,py);}g.closePath();g.fillPath();}
  private symbol(mark:SymbolMark){this.textMark(mark,'#18294a');}
  private textMark(mark:SymbolMark,colour:string){
    const label=this.labels.pop()??this.add.text(0,0,'',{fontFamily:'Rubik,sans-serif',fontSize:'13px',color:'#18294a',fontStyle:'bold'}).setOrigin(.5).setDepth(3).setResolution(this.density);
    if(label.parentContainer!==this.root){this.root.add(label);this.root.sort('depth');}
    if(parseFloat(String(label.style.fontSize))!==mark.size)label.setFontSize(mark.size);
    if(label.style.color!==colour)label.setColor(colour);
    label.setPosition(mark.x,mark.y).setText(mark.text).setVisible(true);this.activeLabels.push(label);
  }
  private pedestal(r:Pose,completed:boolean,index:number,now:number){
    const second=goalList(this.goal).findIndex(g=>g.index===index)===1,base=second?this.secondCrystalBase:this.crystalBase,shards=second?this.secondCrystalShards:this.crystalShards;if(!base)return;
    const source=base.texture.getSourceImage(),ratio=source.height/source.width;
    const below=Math.max(8,this.viewHeight-r.y-r.h-4),width=Math.min(110,r.w*1.55,2*(r.x-4),2*(this.viewWidth-r.x-4),below/(ratio*.55)),height=width*ratio;
    const burst=this.bursts.find(b=>b.index===index&&!b.final),age=completed?(burst?now-burst.start:10000):-1;
    base.setPosition(r.x,r.y+r.h+2).setDisplaySize(width,height).setRotation(0).setAlpha(1).clearTint();
    shards.forEach(s=>s.setVisible(false));
    if(!completed){base.setVisible(true);return;}
    if(this.reduced){base.setVisible(age<220).setAlpha(Math.max(0,1-age/220));return;}
    base.setVisible(age<70);if(age<70){base.setTintFill(0xd9ffff);return;}
    const p=Math.min(1,(age-70)/580);if(p>=1)return;
    const directions=[-.35,.35,-.9,.9,0],jumps=[24,26,17,19,12],spins=[-.6,.6,-.95,.95,.12];
    shards.forEach((shard,i)=>{
      const dx=Math.max(4-r.x+width/2,Math.min(this.viewWidth-4-r.x-width/2,directions[i]*width*p*.6));
      shard.setVisible(true).setPosition(r.x+dx,r.y+r.h+2+p*p*35-Math.sin(p*Math.PI)*jumps[i]).setDisplaySize(width,height).setRotation(spins[i]*p).setAlpha(Math.pow(1-p,1.2));
    });
  }
  private restingTube(r:Pose,layers:Layer[],selected:boolean,target:boolean,index:number,now:number){
    if(!!goalAt(this.goal,index))this.pedestal(r,sealedTube(this.board,index,this.goal)&&layers.reduce((v,l)=>v+l.amount,0)>=8-.001,index,now);
    const age=now-(this.settles.get(index)??-10000),shake=now-(this.pulses.get(index)??-10000),opening=this.corkOpen.get(index)??0;
    // Cache only settled, unselected vessels. Moving liquid, ripples, corks and glows stay live.
    const stable=!this.reveals.size&&!this.bursts.some(b=>b.index===index&&!b.final)&&!selected&&!target&&!this.busyTube(index)&&!this.liquid.has(index)&&!this.bodyMotion.has(index)&&age>=650&&shake>=220&&opening===0&&(this.selectionY.get(index)??0)===0&&now-this.entrance>=260;
    const key=stable?JSON.stringify([r,layers,this.light,this.symbols,this.goal,this.popped.has(index)]):'',cached=this.tubes.get(index);
    if(stable&&cached?.key===key){
      this.glass?.restore(index,cached.cork,r);
      for(const command of cached.commands)this.ink.commandBuffer.push(command);
      this.hitPolygons.set(index,cached.poly);for(const mark of cached.symbols)this.textMark(mark,mark.colour??'#18294a');return;
    }
    const start=this.ink.commandBuffer.length,labelStart=this.activeLabels.length;
    const {poly}=this.tube(r,layers,0,selected,target,index,now);
    if(stable)this.tubes.set(index,{key,commands:this.ink.commandBuffer.slice(start),poly,cork:this.glass?.corkVisible(index)??false,symbols:this.activeLabels.slice(labelStart).map(l=>({x:l.x,y:l.y,text:l.text,size:parseFloat(String(l.style.fontSize)),colour:String(l.style.color)}))});
  }
  private surfaceWave(index:number,now:number,depth:number,height:number){
    if(this.reduced)return 0;
    const limit=Math.min(4,height*.035,depth*.20),x=this.liquid.get(index)?.x??0;
    return limit*Math.tanh(x/Math.max(.1,limit));
  }
  private tube(r:Pose,layers:Layer[],angle:number,selected:boolean,target:boolean,index:number,now:number){
    const g=this.ink,w=r.w*.5,h=r.h,capacity=capacityAt(this.goal,index),isGoal=!!goalAt(this.goal,index);
    const settle=this.settles.get(index),age=settle===undefined?10000:now-settle;
    const landing=age<400?Math.sin(age/30)*Math.exp(-age/90):0;
    const contact=landing*.7;
    const pulse=this.pulses.get(index),rejectAge=pulse===undefined?10000:now-pulse;
    const shake=rejectAge<200?Math.sin(rejectAge/13)*4*Math.exp(-rejectAge/85):0;
    const c=Math.cos(angle),s=Math.sin(angle),stretch=1+(isGoal?.04:.027)*Math.tanh((this.bodyMotion.get(index)?.x??0)/1.5);
    // Reciprocal scaling preserves the silhouette area and anchors its bottom.
    const transform=(x:number,y:number)=>{x*=stretch;y=h+(y-h)/stretch;return {x:r.x+shake+x*c-y*s,y:r.y+x*s+y*c};};
    const local=vesselPolygon(r.w,h);
    const poly=local.map(p=>transform(p.x,p.y));this.hitPolygons.set(index,poly);
    // A soft elliptical contact shadow anchors the bottle while the lifted one floats.
    const resting=this.positions()[index];const shadowY=resting.y+resting.h+9;const lift=Math.min(1,Math.abs(r.y-resting.y)/50);for(let n=3;n>=1;n--){g.fillStyle(this.light?0x6782a6:0x030c0a,.055*(1-lift*.8));g.fillEllipse(resting.x,shadowY,r.w*(1+n*.20)*(1-lift*.25)*(1+contact*.05),4+n*2);}
    if(selected||target){const glow=selected?0xb9e3ff:0x68d9e9;for(let n=3;n>=1;n--){g.lineStyle(n*5,glow,.025);g.strokePoints(poly,true);}g.fillStyle(glow,.12*(1-lift));g.fillEllipse(resting.x,shadowY,r.w*1.25,12);}
    this.polygon(poly,this.light?0x8bbbe4:0xb8e4ff,this.light?.13:.045);
    if(isGoal){
      const colour=COLORS[goalAt(this.goal,index)!.color];
      g.lineStyle(3,colour,.7);g.strokePoints(poly,true);
      if(!layers.length){this.polygon(poly,colour,.065);g.fillStyle(colour,.35);g.fillCircle(r.x,r.y+h*.46,r.w*.2);if(this.symbols)this.textMark({x:r.x,y:r.y+h*.46,text:SIGNS[goalAt(this.goal,index)!.color],size:Math.min(22,r.w*.4)},this.light?'#18294a':'#e6f7ff');}
      for(let k=1;k<8;k++){const y=r.y+h*(1-k*LIQUID_FILL/8);g.lineStyle(1,0xffffff,.3);g.lineBetween(r.x+r.w*.28,y,r.x+r.w*.43,y);}

    }
    if(isMini(this.goal,index)&&Math.abs(angle)<.05){
      const y=r.y+surface(local,LIQUID_FILL*.5);g.lineStyle(1.3,this.light?0x416b94:0xd7f6ff,.6);g.lineBetween(r.x+r.w*.29,y,r.x+r.w*.43,y);
    }
    const total=layers.reduce((v,l)=>v+l.amount,0);
    const bounds={lo:Math.min(...poly.map(p=>p.x)),hi:Math.max(...poly.map(p=>p.x))},fractions=[0];
    for(const l of layers)fractions.push(fractions.at(-1)!+l.amount/capacity*LIQUID_FILL);
    const displacement=this.surfaceWave(index,now,total/capacity*h*LIQUID_FILL,h)*(1-smooth(Math.abs(angle)/.12)),mesh=Math.abs(displacement)>.002?liquidMesh(poly,fractions,displacement,h):undefined;
    const boundaries=mesh?.boundaries??fractions.map(f=>({y:surface(poly,f),amplitude:0})),frameBounds={left:bounds.lo,right:bounds.hi};
    for(let n=0;n<layers.length;n++){
      const layer=layers[n];if(layer.amount<.001)continue;
      const low=boundaries[n].y,high=boundaries[n+1].y,base=blend(0x657ba8,COLORS[layer.color],layer.reveal??1),wave=boundaries[n+1].amplitude;
      const band=mesh?liquidContour(mesh,n,n+1):clip(clip(poly,high,true),low,false);
      const receiving=this.flight?.to===index&&!this.flight.received&&now>=this.flight.start+this.flight.timing.lift;
      const flowAge=receiving?now-this.flight!.start-this.flight!.timing.lift:0;
      // Cross-section shading is clipped to the actual liquid, including on a tilted vessel.
      for(let k=0;k<28;k++){
        const t=(k+.5)/28,x0=Phaser.Math.Linear(bounds.lo,bounds.hi,k/28),x1=Phaser.Math.Linear(bounds.lo,bounds.hi,(k+1)/28)+.8;
        // A narrow glossy reflection leaves the body saturated. Neutral edge shade
        // keeps warm liquid warm instead of mixing every hue with the blue glass.
        let col=blend(base,0x000000,.14*Math.pow(Math.abs(t-.43)*1.75,2));
        col=blend(col,0xffffff,Math.exp(-Math.pow((t-(.18+Math.sin(angle)*.055+Math.tanh((this.liquid.get(index)?.x??0)/4)*.014))/.065,2))*.17);
        this.polygon(clipX(clipX(band,x0,true),x1,false),col);
      }
      if(n===layers.length-1&&Math.abs(angle)<.09){
        
        const cap=clip(poly,high+3,true);const left=cap.length?Math.min(...cap.map(p=>p.x)):r.x-w,right=cap.length?Math.max(...cap.map(p=>p.x)):r.x+w;
        if(Math.abs(wave)<.5){g.fillStyle(blend(base,0xffffff,.10),.94*(1-smooth(Math.abs(wave)/.5)));g.fillEllipse((left+right)/2,high+.7,(right-left)-1,Math.max(3,r.w*.105));}
        g.lineStyle(1.2,0xffffff,n===layers.length-1?.18:.08);g.beginPath();for(let k=0;k<=14;k++){const x=left+(right-left)*k/14,y=boundaryY(frameBounds,boundaries[n+1],x);if(k===0)g.moveTo(x,y);else g.lineTo(x,y);}g.strokePath();
        if(n===layers.length-1&&(receiving||age<280)){const p=(receiving?flowAge%140:age)/280;g.lineStyle(1.2,0xffffff,.55*(1-p));g.strokeEllipse(r.x,high+2,r.w*.8*p,4+3*p);}
      }
      if((layer.reveal??1)<1&&layer.amount>.35&&Math.abs(angle)<.1){const p=layer.reveal??1,c=blend(0xe6f3ff,base,p);this.textMark({x:r.x,y:(low+high)/2,text:'?',size:Math.floor(Math.max(10,Math.min(19,(low-high)*.68,r.w*.47)))},'#'+c.toString(16).padStart(6,'0'));}
      if((layer.reveal??1)===1&&this.symbols&&layer.amount>.35&&Math.abs(angle)<.1){const fontSize=Math.floor(Math.max(8,Math.min(14,(low-high)*.62,r.w*.38)));this.symbol({x:r.x,y:(low+high)/2,text:SIGNS[layer.color],size:fontSize});}
    }
    const fill=this.bursts.find(b=>b.index===index&&!b.final&&now>=b.start);
    if(fill&&this.selected!==index&&this.flight?.from!==index){
      const elapsed=now-fill.start,p=smooth((elapsed-35)/440),strength=Math.sin(Math.PI*p)**2;
      if(this.reduced){this.polygon(clip(poly,boundaries.at(-1)!.y,true),fill.color,Math.max(0,1-elapsed/300)*.12);}
      else if(strength>.002){
        const lightMesh=mesh??liquidMesh(poly,fractions,0,h),center=r.y+h-(h-(boundaries.at(-1)!.y-r.y))*p,thick=Math.max(6,h*.055);
        for(const column of lightMesh.columns){const liquid=cutBoundary(lightMesh,column,column.poly,lightMesh.boundaries.at(-1)!,true),u=((column.left+column.right)/2-bounds.lo)/(bounds.hi-bounds.lo),y=center-Math.cos((u-.5)*Math.PI)*r.w*.18;
          for(let j=3;j>=1;j--)this.polygon(clip(clip(liquid,y-thick*j/3,true),y+thick*j/3,false),blend(fill.color,0xffffff,.55),strength*.055);
        }
      }
    }
    const material=this.glass?.enabled;
    if(material){const top=transform(0,0);this.glass!.vessel(index,{...top,width:r.w,height:h,angle,stretch,flying:this.flight?.from===index});}
    else {
    // Legacy glass remains for the giant goal and Canvas renderer.
    g.lineStyle(4,this.light?0x496f9b:0x9bc8ee,this.light?.25:.14);g.strokePoints(poly,true);
    g.lineStyle(1.5,this.light?0x496f9b:0xc9e5ff,this.light?.85:.72);g.strokePoints(poly,true);
    const rimA=transform(-w,0),rimB=transform(w,0);
    g.lineStyle(5,0xa6cbea,.5);g.lineBetween(rimA.x,rimA.y,rimB.x,rimB.y);
    g.lineStyle(1.4,0xf3fbff,.96);g.lineBetween(rimA.x,rimA.y-1,rimB.x,rimB.y-1);
    if(Math.abs(angle)<.05){const rim=transform(0,0);g.lineStyle(1,0xe2f2ff,.7);g.strokeEllipse(rim.x,rim.y,r.w*stretch,Math.max(4,r.w*.13)/stretch);}
    for(const [x,alpha,thick,y1,y2]of [[-w+4,.42,2.1,9,h*.68],[w-3,.10,1,9,h-20]] as number[][]){const a=transform(x,y1),b=transform(x,y2);g.lineStyle(thick,0xffffff,alpha);g.lineBetween(a.x,a.y,b.x,b.y);}
    const bottomA=transform(-w*.5,h-4),bottomB=transform(w*.5,h-4);g.lineStyle(2,0xe2ecff,.30);g.lineBetween(bottomA.x,bottomA.y,bottomB.x,bottomB.y);
    }
    const uniform=!this.frozen(index)&&total===capacity&&sealedTube(this.board,index,this.goal)&&layers.every(l=>l.color===layers[0].color);
    const corkTarget=selected||this.flight?.from===index||this.flight?.to===index&&!this.flight.received?1:0,previous=this.corkOpen.get(index)??corkTarget;
    let opening=previous+(corkTarget-previous)*(1-Math.exp(-this.frameStep/.045));if(Math.abs(opening-corkTarget)<.008)opening=corkTarget;
    this.corkOpen.set(index,opening);
    if(uniform&&!this.popped.has(index)&&Math.abs(angle)<.01&&opening<1&&this.flight?.from!==index&&!(this.flight?.to===index&&!this.flight.received)){
      const burst=[...this.bursts].reverse().find(b=>b.index===index&&(!b.final||now>=b.start)),elapsed=burst?now-burst.start:10000;
      // Cork arrives after the liquid seals; the receiver need not wait for the source.
      const final=burst?.final===true;
      const cork=completionCork(elapsed),drop=final||this.reduced?0:cork.drop;
      const rim=transform(0,0),cw=r.w*(material?.96:.88)*stretch,ch=material?cw*164/290:Math.max(10,r.w*.27),cx=rim.x+opening*10,cy=rim.y-ch*.72+drop*Math.min(1,Math.max(0,rim.y-ch*.72-4)/28)-opening*23;
      const opacity=(1-opening)*(final||this.reduced?1:cork.opacity);
      g.fillStyle(0x081425,.30*opacity);g.fillEllipse(cx,rim.y+2,r.w*.92*stretch,5);
      if(material)this.glass!.cork(index,cx,cy,cw,ch,opacity);
      else {
      g.fillStyle(0x916039,opacity);g.fillRoundedRect(cx-cw/2,cy,cw,ch,3);
      g.fillStyle(0xce9a59,opacity);g.fillRoundedRect(cx-cw/2,cy,cw,ch*.62,3);
      g.fillStyle(0xe9bd7b,opacity);g.fillEllipse(cx,cy+1,cw,Math.max(4,ch*.36));
      g.lineStyle(1,0x734624,.5*opacity);g.lineBetween(cx-cw*.33,cy+ch*.72,cx+cw*.33,cy+ch*.72);
      for(let k=0;k<4;k++){g.fillStyle(0x754528,.42*opacity);g.fillCircle(cx-cw*.32+k*cw*.20,cy+ch*(k%2?.4:.65),.8);}
      }
    }
    return {poly,transform};
  }
  update(){
    if(!this.ink)return;
    const now=performance.now(),dt=Math.min(.035,(now-this.lastFrame)/1000||.016);this.lastFrame=now;this.frameStep=dt;
    if(this.iceRelease&&now-this.iceRelease.start>=680)this.iceRelease=undefined;
    if(this.selected!==this.lastSelected){if(this.lastSelected!==null)this.land(this.lastSelected,2);if(this.selected!==null)this.land(this.selected,2);this.lastSelected=this.selected;}
    if(this.reduced){this.liquid.clear();this.bodyMotion.clear();}
    else for(let i=0;i<this.board.length;i++){
      const f=this.flight,age=f?now-f.start-f.timing.lift:-1,flow=f?streamEnvelope(age,f.timing.flow):0;
      const s=this.liquid.get(i)??{x:0,v:0};
      const force=f?.to===i&&age>=0&&age<f.timing.flow?Math.sin(age/42)*(650+f.amount*180)*flow:0;
      stepLiquid(s,dt,force);
      if(Math.abs(s.x)+Math.abs(s.v)*.04>.008||force)this.liquid.set(i,s);else this.liquid.delete(i);
    }
    for(const [i,body]of this.bodyMotion){stepLiquid(body,dt);if(Math.abs(body.x)+Math.abs(body.v)*.04<.008)this.bodyMotion.delete(i);}
    for(const [id,start] of this.reveals)if(now>=start+(this.reduced?0:280)){this.reveals.delete(id);this.previousSignature='';}
    const signature=JSON.stringify([this.knowledge,this.board,this.goal,this.iceHeld,this.iceRelease?.start??0,this.lockedExtra,this.selected,this.hintMove,this.queuedMove,this.symbols,this.light,this.viewWidth,this.viewHeight,now-this.entrance>=260]);
    const settling=[...this.selectionY].some(([i,y])=>Math.abs(y-((this.selected===i||this.hintMove?.from===i)&&!this.busyTube(i)?-17:0))>.1);
    const activeSettle=this.liquid.size>0||this.bodyMotion.size>0||[...this.settles.values()].some(t=>now-t<650),shaking=[...this.pulses.values()].some(t=>now-t<220);
    const corkAnimating=[...this.corkOpen.values()].some(v=>v>0&&v<1);
    if(!this.reveals.size&&!this.iceRelease&&!this.flight&&!corkAnimating&&!settling&&!shaking&&!activeSettle&&!this.bursts.length&&!this.particles.length&&now-this.entrance>260&&signature===this.previousSignature)return;
    this.previousSignature=signature;this.glass?.beginFrame();this.hitPolygons.clear();this.ink.clear();this.flyingInk.clear();this.fx.clear();for(const l of this.queueLabels)l.setVisible(false);for(const l of this.activeLabels){l.setVisible(false);this.labels.push(l);}this.activeLabels=[];
    const poses=this.positions(),f=this.flight;
    const frame=f?pourFrame(now-f.start,f.timing):{t:0,remaining:0,tail:-1},t=frame.t,transfer=f?pourTransfer(t):0;
    if(f&&t>=.73&&!f.received){f.received=true;this.land(f.to,f.amount);this.onReceive();}
    if(f&&t>=.25&&!this.startedSound){this.startedSound=true;if(t<.73)this.onPour(frame.remaining,(f.before[f.to].length+f.amount*transfer)/capacityAt(this.goal,f.to),(f.before[f.to].length+f.amount)/capacityAt(this.goal,f.to));}
    for(let i=0;i<this.board.length;i++){
      if(f&&i===f.from)continue;
      const r={...poses[i]},chosen=(this.selected===i||this.hintMove?.from===i)&&!goalAt(this.goal,i);
      const target=!this.queuedMove&&(this.selected!==null&&!!moveFor(this.board,this.selected,i,this.goal)||this.hintMove?.to===i);
      const aim=chosen&&!this.busyTube(i)?-17:0,prev=this.selectionY.get(i)??0;let velocity=this.selectionV.get(i)??0;velocity+=((aim-prev)*520-velocity*28)*dt;let offset=prev+velocity*dt;if(Math.abs(offset-aim)<.04&&Math.abs(velocity)<.2){offset=aim;velocity=0;}this.selectionY.set(i,offset);this.selectionV.set(i,velocity);r.y+=offset;
      if(now-this.entrance<240){const p=Math.max(0,1-(now-this.entrance)/240);r.y+=p*p*12;}
      let ls=this.layers(f?f.before[i]:this.board[i],f?f.ids?.[i]:this.knowledge?.ids[i],now);
      if(f&&i===f.to){const last=ls.at(-1);if(last?.color===f.color)last.amount+=f.amount*transfer;else ls.push({color:f.color,amount:f.amount*transfer});if(t<.73)this.impulses.set(i,.6+f.amount*.15);}
      this.restingTube(r,ls,chosen,target,i,now);
      if(target){const color=this.light?0x23649b:0xa6e8ff;this.fx.lineStyle(2,color,.8);this.fx.strokeEllipse(r.x,r.y+r.h+10,r.w*1.25,9);if(this.hintMove?.to===i){const y=r.y-12;this.fx.lineStyle(2.5,color,1);this.fx.beginPath();this.fx.moveTo(r.x,y-9);this.fx.lineTo(r.x,y+2);this.fx.moveTo(r.x-4,y-2);this.fx.lineTo(r.x,y+2);this.fx.lineTo(r.x+4,y-2);this.fx.strokePath();}}
    }
    if(this.lockedExtra&&poses[this.board.length])this.restingTube({...poses[this.board.length]},[],false,false,this.board.length,now);
    if(f){
      const origin=poses[f.from],dest=poses[f.to];
      const r=pourPose(origin,dest,t,this.viewWidth,this.viewHeight,f.lifted,f.plan),angle=r.angle,tipX=r.tipX;
      const ls=this.layers(f.before[f.from],f.ids?.[f.from],now);let remaining=f.amount*transfer;for(let i=ls.length-1;i>=0&&remaining>0;i--){const q=Math.min(ls[i].amount,remaining);ls[i].amount-=q;remaining-=q;}
      // The flying liquid must occlude resting glass as well as resting liquid.
      const restingInk=this.ink;this.ink=this.flyingInk;
      let result:ReturnType<WaterScene['tube']>;
      try{result=this.tube(r,ls,angle,true,false,f.from,now);}finally{this.ink=restingInk;}
      const {transform}=result;
      if(t>=.25&&t<.73){
        const lip=transform(tipX,0),endY=dest.y+surface(vesselPolygon(dest.w,dest.h),(f.before[f.to].length+f.amount*transfer)*LIQUID_FILL/capacityAt(this.goal,f.to)),color=COLORS[f.color];
        const stream:Point[]=[];for(let k=0;k<=18;k++){const v=k/18;stream.push({x:Phaser.Math.Linear(lip.x,dest.x,v)+Math.sin(v*Math.PI)*Math.sin(now/60)*1.1,y:Phaser.Math.Linear(lip.y,Math.max(dest.y+5,endY),v)});}
        const taper=streamEnvelope(now-f.start-f.timing.lift,f.timing.flow);
        for(const [width,alpha,col]of [[(7+f.amount*1.3)*taper,.07,color],[(3.6+f.amount*.8)*taper,.95,color],[1.2*taper,.65*taper,0xffffff]]){if(width>.01){this.fx.lineStyle(width,col,alpha);this.fx.strokePoints(stream,false);}}
        for(let n=0;n<5;n++){const phase=((now/260)+n*.2)%1;this.fx.fillStyle(blend(color,0xffffff,.18),(1-phase)*taper);this.fx.fillEllipse(dest.x+Math.sin(n*2.4+now/120)*phase*14,endY-Math.sin(phase*Math.PI)*13,2.5*(1-phase)+1,4*(1-phase)+1);}
        this.fx.lineStyle(1.5,0xffffff,.45*taper);this.fx.strokeEllipse(dest.x,endY+2,9+Math.sin(now/40)*4,3);
      }
      if(frame.tail>=-40&&frame.tail<Math.min(110,f.timing.back+40)-40){
        const q=(frame.tail+40)/Math.min(110,f.timing.back+40),drop=smooth(q/.16)*smooth((1-q)/.22),end=pourPose(origin,dest,.73,this.viewWidth,this.viewHeight,0,f.plan);
        const lip={x:end.x+end.tipX*Math.cos(end.angle),y:end.y+end.tipX*Math.sin(end.angle)},endY=dest.y+surface(vesselPolygon(dest.w,dest.h),(f.before[f.to].length+f.amount)*LIQUID_FILL/capacityAt(this.goal,f.to));
        this.fx.fillStyle(blend(COLORS[f.color],0xffffff,.15),drop);this.fx.fillEllipse(Phaser.Math.Linear(lip.x,dest.x,q),Phaser.Math.Linear(lip.y,endY,q*q),2.5,4*(1-q)+2);
      }
      if(t>=1){this.flight=undefined;this.land(f.from);this.onComplete();}
    }
    // A numbered source and destination arrow describe the single next move, not a solver hint.
    const pendingSource=this.queuedMove?.from??(this.flight?this.selected:null);
    if(pendingSource!==null){
      for(const [n,index]of [pendingSource,this.queuedMove?.to??null].entries()){
        if(index===null)continue;const r=poses[index];if(!r)continue;
        const x=r.x,y=r.y-15,g=this.fx;
        g.lineStyle(1.5,0xffce63,.65);g.lineBetween(x,y+10,x,r.y+5);
        g.lineBetween(x-r.w*.35,r.y+5,x+r.w*.35,r.y+5);
        g.fillStyle(0xffce63,1);g.fillCircle(x,y,10);g.lineStyle(1,0xffe9a8,.9);g.strokeCircle(x,y,10);
        this.queueLabels[n]?.setPosition(x,y-.5).setVisible(true);
        g.lineStyle(2,0xffce63,.95);g.strokeEllipse(r.x,r.y+r.h+10,r.w*1.18,8);
      }
    }
    // If a completed vessel is immediately reused, it must not seal an empty slot.
    this.bursts=this.bursts.filter(b=>b.final||!this.popped.has(b.index)&&sealedTube(this.board,b.index,this.goal));
    for(const b of this.bursts){
      const age=now-b.start;
      if(!b.final){
        const phase=age>=FILL_BEATS[2]?2:age>=FILL_BEATS[1]?1:0;
        if(phase>(b.phase??0)){b.phase=phase;if(!this.busyTube(b.index)&&this.selected!==b.index){this.bodyImpulse(b.index,phase===1?24:-42);if(phase===2)this.fillSplash(b.index,2);this.onPhase(phase,!!b.heavy);}}
        if(!b.sealed&&age>=FILL_BEATS[2]){b.sealed=true;if(!this.busyTube(b.index)&&this.selected!==b.index)this.onSeal();}
      }else if(age>=0&&!b.fired){b.fired=true;this.popped.add(b.index);this.onFinale(b.order??0,!!b.heavy);}
    }
    const frozenIndex=iceIndex(this.goal);
    if(frozenIndex!==undefined&&poses[frozenIndex]){
      const r=poses[frozenIndex];if(this.frozen(frozenIndex))drawIce(this.fx,r,-1,this.reduced);
      else if(this.iceRelease)drawIce(this.fx,r,now-this.iceRelease.start,this.reduced);
    }
    this.overlay.draw(this.bursts.filter(b=>b.final),poses,now,this.reduced);
    this.bursts=this.bursts.filter(b=>now-b.start<(b.final?1900:900));
    for(const b of this.bursts){if(now<b.start)continue;const r=poses[b.index],age=now-b.start,p=age/(b.final?1900:900),fade=Math.pow(1-p,1.7),g=this.fx;
      if(b.final){for(let n=3;n>=1;n--){g.fillStyle(b.color,.035*fade);g.fillEllipse(r.x,r.y+r.h*.5,r.w*(1+n*.6),r.h*(1+n*.1));}}
      else if(!this.reduced&&this.selected!==b.index&&this.flight?.from!==b.index){
        const beat=age<570?age-260:age-570,q=Math.max(0,1-Math.abs(beat)/130);
        if(q>0){this.star(r.x-r.w*.43,r.y+3,5*q,0xf1fdff,q,Math.PI*.15);this.star(r.x+r.w*.46,r.y+8,3*q,b.color,q,0);}
      }
    }

    this.particles=this.particles.filter(p=>p.age<p.life);
    for(const p of this.particles){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=320*dt;const fade=Math.max(0,1-p.age/p.life);this.fx.fillStyle(p.color,fade*.8);this.fx.fillEllipse(p.x,p.y,p.size*fade,p.size*fade*1.5);this.fx.fillStyle(0xffffff,fade*.45);this.fx.fillCircle(p.x-.5,p.y-.7,p.size*fade*.28);}
    this.glass?.finishFrame();
  }
}
