import Phaser from 'phaser';
import { type Board, type Move, completeTube, moveFor } from '../core/rules';
import { area, clip, layout, surface, planPour, pourPose, vesselPolygon, LIQUID_FILL, pourTransfer, pourTiming, pourFrame, type PourPlan, type Point } from './geometry';
export const COLORS=[0x22d9eb,0xffb51b,0xb75bfa,0x3ce590,0xff496d,0x397bff,0xe9ef30,0xf08037];
const SIGNS=['●','▲','◆','✚','♥','★','■','✦'];
type Pose={x:number;y:number;w:number;h:number};
type Layer={color:number;amount:number};
type Flight=Move & {before:Board;start:number;duration:number;timing:ReturnType<typeof pourTiming>;received:boolean;lifted:number;plan:PourPlan};
type Burst={index:number;start:number;color:number;final:boolean};
type SymbolMark={x:number;y:number;text:string;size:number};
type TubeCache={key:string;commands:number[];poly:Point[];symbols:SymbolMark[]};
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
  private fx!:Phaser.GameObjects.Graphics;
  private labels:Phaser.GameObjects.Text[]=[];
  private activeLabels:Phaser.GameObjects.Text[]=[];
  private floatLabels:Phaser.GameObjects.Text[]=[];
  private queueLabels:Phaser.GameObjects.Text[]=[];
  slots=5;board:Board=[];selected:number|null=null;hintMove:Move|null=null;queuedMove:Move|null=null;symbols=false;light=false;
  private flight?:Flight;
  private selectionY=new Map<number,number>();
  private hitPolygons=new Map<number,Point[]>();
  private corkOpen=new Map<number,number>();
  private selectionV=new Map<number,number>();
  private pulses=new Map<number,number>();
  private settles=new Map<number,number>();
  private impulses=new Map<number,number>();
  private bursts:Burst[]=[];
  private particles:Particle[]=[];
  private startedSound=false;
  private previousSignature='';
  private lastFrame=0;private frameStep=.016;
  onTap:(i:number|null)=>void=()=>{};
  onPour:(remainingMs:number,fill:number,endFill:number)=>void=()=>{};
  onComplete:()=>void=()=>{};
  create(){
    this.root=this.add.container(0,0).setScale(this.density);
    this.ink=this.add.graphics();this.fx=this.add.graphics().setDepth(4);this.root.add([this.ink,this.fx]);
    this.queueLabels=['2','↓'].map(text=>{const label=this.add.text(0,0,text,{fontFamily:'sans-serif',fontSize:'13px',fontStyle:'bold',color:'#402d19'}).setOrigin(.5).setDepth(6).setResolution(this.density).setVisible(false);this.root.add(label);return label;});this.root.sort('depth');
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
    const slot=poses.findIndex(r=>Math.abs(x-r.x)<r.hitW/2&&Math.abs(y-(r.y+r.h/2))<r.hitH/2);
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
  positions(){const key=`${this.viewWidth}:${this.viewHeight}:${this.slots}`;if(key!==this.layoutKey){this.layoutKey=key;this.layoutCache=layout(this.viewWidth,this.viewHeight,this.slots);}return this.layoutCache;}
  reveal(){this.entrance=performance.now();this.previousSignature='';}
  setBoard(b:Board){this.board=b;}
  animate(before:Board,m:Move,fast:boolean){this.flight={...m,before,start:performance.now(),duration:pourTiming(m.amount,fast).duration,timing:pourTiming(m.amount,fast),received:false,lifted:(this.selectionY.get(m.from)??0)+12*Math.max(0,1-(performance.now()-this.entrance)/240)**2,plan:planPour(this.positions()[m.from],this.positions()[m.to],this.viewWidth,this.viewHeight,before[m.from].length,before[m.from].length-m.amount)};this.startedSound=false;this.selectionY.set(m.from,0);this.selectionV.set(m.from,0);this.selectionY.set(m.to,0);this.selectionV.set(m.to,0);}
  get busy(){return !!this.flight;}
  busyTube(i:number){return this.flight?.from===i||this.flight?.to===i;}
  skip(){this.flight=undefined;this.startedSound=false;this.previousSignature='';}
  resetEffects(){this.skip();this.tubes.clear();this.hitPolygons.clear();this.corkOpen.clear();for(const l of this.queueLabels)l.setVisible(false);this.bursts=[];this.particles=[];this.settles.clear();this.impulses.clear();this.pulses.clear();this.selectionY.clear();this.selectionV.clear();this.entrance=0;this.ink?.clear();this.fx?.clear();for(const l of this.floatLabels){this.tweens.killTweensOf(l);l.destroy();}this.floatLabels=[];}
  reject(i:number){this.pulses.set(i,performance.now());}
  land(i:number,amount=1){this.settles.set(i,performance.now());this.impulses.set(i,.55+amount*.16);}
  celebrate(index:number,final=false){
    const r=this.positions()[index];if(!r)return;
    const color=COLORS[this.board[index]?.[0]??0],now=performance.now();this.corkOpen.set(index,0);this.bursts.push({index,start:now,color,final});
    for(let n=0;n<(final?28:18);n++){
      const theta=Math.PI*2*n/(final?28:18),speed=35+Math.random()*90;
      this.particles.push({x:r.x,y:r.y+r.h*.43,vx:Math.cos(theta)*speed,vy:Math.sin(theta)*speed-60,age:0,life:.45+Math.random()*.4,color:n%3?color:0xfff0bc,size:2+Math.random()*2,spin:Math.random()*6});
    }
    this.particles=this.particles.slice(-100);

  }
  private polygon(points:Point[],color:number,alpha=1,g=this.ink){if(points.length<3||area(points)<.005)return;g.fillStyle(color,alpha);g.fillPoints(points,true);}
  private star(x:number,y:number,r:number,color:number,alpha:number,rotation=0){const g=this.fx;g.fillStyle(color,alpha);g.beginPath();for(let n=0;n<8;n++){const a=rotation+n*Math.PI/4,s=n%2?r*.26:r;const px=x+Math.cos(a)*s,py=y+Math.sin(a)*s;if(n===0)g.moveTo(px,py);else g.lineTo(px,py);}g.closePath();g.fillPath();}
  private symbol(mark:SymbolMark){
    const label=this.labels.pop()??this.add.text(0,0,'',{fontFamily:'sans-serif',fontSize:'13px',color:'#18294a',fontStyle:'bold'}).setOrigin(.5).setDepth(3).setResolution(this.density);
    if(label.parentContainer!==this.root){this.root.add(label);this.root.sort('depth');}
    if(parseFloat(String(label.style.fontSize))!==mark.size)label.setFontSize(mark.size);
    label.setPosition(mark.x,mark.y).setText(mark.text).setVisible(true);this.activeLabels.push(label);
  }
  private restingTube(r:Pose,layers:Layer[],selected:boolean,target:boolean,index:number,now:number){
    const age=now-(this.settles.get(index)??-10000),shake=now-(this.pulses.get(index)??-10000),opening=this.corkOpen.get(index)??0;
    // Cache only settled, unselected vessels. Moving liquid, ripples, corks and glows stay live.
    const stable=!selected&&!target&&!this.busyTube(index)&&age>=650&&shake>=220&&opening===0&&(this.selectionY.get(index)??0)===0&&now-this.entrance>=260;
    const key=stable?JSON.stringify([r,layers,this.light,this.symbols]):'',cached=this.tubes.get(index);
    if(stable&&cached?.key===key){
      for(const command of cached.commands)this.ink.commandBuffer.push(command);
      this.hitPolygons.set(index,cached.poly);for(const mark of cached.symbols)this.symbol(mark);return;
    }
    const start=this.ink.commandBuffer.length,labelStart=this.activeLabels.length;
    const {poly}=this.tube(r,layers,0,selected,target,index,now);
    if(stable)this.tubes.set(index,{key,commands:this.ink.commandBuffer.slice(start),poly,symbols:this.activeLabels.slice(labelStart).map(l=>({x:l.x,y:l.y,text:l.text,size:parseFloat(String(l.style.fontSize))}))});
  }
  private tube(r:Pose,layers:Layer[],angle:number,selected:boolean,target:boolean,index:number,now:number){
    const g=this.ink,w=r.w*.5,h=r.h;
    const settle=this.settles.get(index),age=settle===undefined?10000:now-settle;
    const landing=age<400?Math.sin(age/30)*Math.exp(-age/90):0;
    const contact=landing*.7;
    const pulse=this.pulses.get(index),rejectAge=pulse===undefined?10000:now-pulse;
    const shake=rejectAge<200?Math.sin(rejectAge/13)*4*Math.exp(-rejectAge/85):0;
    const c=Math.cos(angle),s=Math.sin(angle);
    const transform=(x:number,y:number)=>({x:r.x+shake+x*c-y*s,y:r.y+x*s+y*c});
    const local=vesselPolygon(r.w,h);
    const poly=local.map(p=>transform(p.x,p.y));this.hitPolygons.set(index,poly);
    // A soft elliptical contact shadow anchors the bottle while the lifted one floats.
    const resting=this.positions()[index];const shadowY=resting.y+resting.h+9;const lift=Math.min(1,Math.abs(r.y-resting.y)/50);for(let n=3;n>=1;n--){g.fillStyle(this.light?0x746c50:0x030c0a,.055*(1-lift*.8));g.fillEllipse(resting.x,shadowY,r.w*(1+n*.20)*(1-lift*.25)*(1+contact*.05),4+n*2);}
    if(selected||target){const glow=selected?0xb9e3ff:0x68d9e9;for(let n=3;n>=1;n--){g.lineStyle(n*5,glow,.025);g.strokePoints(poly,true);}g.fillStyle(glow,.12*(1-lift));g.fillEllipse(resting.x,shadowY,r.w*1.25,12);}
    this.polygon(poly,this.light?0x8bbbe4:0xb8e4ff,this.light?.13:.045);
    const total=layers.reduce((v,l)=>v+l.amount,0);let sum=0;
    const bounds={lo:Math.min(...poly.map(p=>p.x)),hi:Math.max(...poly.map(p=>p.x))};
    for(let n=0;n<layers.length;n++){
      const layer=layers[n];if(layer.amount<.001)continue;
      const low=surface(poly,sum/4*LIQUID_FILL),high=surface(poly,(sum+layer.amount)/4*LIQUID_FILL),base=COLORS[layer.color];
      let band=clip(clip(poly,high,true),low,false);
      const wave=age<550?Math.sin(age/36)*Math.min(2.2,h*.025)*(this.impulses.get(index)??1)*Math.exp(-age/150):0;
      if(Math.abs(angle)<.08&&n===layers.length-1&&Math.abs(wave)>.05){
        const section=clip(poly,high,true),left=Math.min(...section.map(p=>p.x)),right=Math.max(...section.map(p=>p.x)),top=Array.from({length:17},(_,k)=>({x:left+(right-left)*k/16,y:high+Math.sin(k/16*Math.PI*2)*wave}));
        band=clip(poly,low,false);band=clip(band,high-Math.abs(wave),true);
        const lower=band.filter(p=>p.y>high+Math.abs(wave)+.1);band=[...top,...lower.sort((a,b)=>b.x-a.x)];
      }
      // Cross-section shading is clipped to the actual liquid, including on a tilted vessel.
      for(let k=0;k<28;k++){
        const t=(k+.5)/28,x0=Phaser.Math.Linear(bounds.lo,bounds.hi,k/28),x1=Phaser.Math.Linear(bounds.lo,bounds.hi,(k+1)/28)+.8;
        let col=blend(base,0x0b2353,.20*Math.pow(Math.abs(t-.4)*1.8,1.4));
        col=blend(col,0xffffff,Math.exp(-Math.pow((t-.22)/.22,2))*.13);
        this.polygon(clipX(clipX(band,x0,true),x1,false),col);
      }
      if(Math.abs(angle)<.09){
        
        const cap=clip(poly,high+3,true);const left=cap.length?Math.min(...cap.map(p=>p.x)):r.x-w,right=cap.length?Math.max(...cap.map(p=>p.x)):r.x+w;
        g.fillStyle(blend(base,0xffffff,.25),.82);g.fillEllipse((left+right)/2,high+.7,(right-left)-1,Math.max(3,r.w*.105));
        g.lineStyle(1.2,0xffffff,.28);g.beginPath();for(let k=0;k<=14;k++){const x=left+(right-left)*k/14,y=high+Math.sin(k/14*Math.PI*2)*wave;if(k===0)g.moveTo(x,y);else g.lineTo(x,y);}g.strokePath();
        if(n===layers.length-1&&age<280){const p=age/280;g.lineStyle(1.2,0xffffff,.55*(1-p));g.strokeEllipse(r.x,high+2,r.w*.8*p,4+3*p);}
      }
      if(this.symbols&&layer.amount>.35&&Math.abs(angle)<.1){const fontSize=Math.floor(Math.max(8,Math.min(14,(low-high)*.62,r.w*.38)));this.symbol({x:r.x,y:(low+high)/2,text:SIGNS[layer.color],size:fontSize});}
      sum+=layer.amount;
    }
    // A clean rounded glass silhouette: bright lip, thick base, one broad reflection.
    g.lineStyle(4,this.light?0x5785ad:0x9bc8ee,this.light?.20:.14);g.strokePoints(poly,true);
    g.lineStyle(1.5,this.light?0x4e7696:0xc9e5ff,.72);g.strokePoints(poly,true);
    const rimA=transform(-w,0),rimB=transform(w,0);
    g.lineStyle(5,0xa6cbea,.5);g.lineBetween(rimA.x,rimA.y,rimB.x,rimB.y);
    g.lineStyle(1.4,0xf3fbff,.96);g.lineBetween(rimA.x,rimA.y-1,rimB.x,rimB.y-1);
    if(Math.abs(angle)<.05){g.lineStyle(1,0xe2f2ff,.7);g.strokeEllipse(r.x,r.y,r.w,Math.max(4,r.w*.13));}
    for(const [x,alpha,thick,y1,y2]of [[-w+4,.42,2.1,9,h*.68],[w-3,.10,1,9,h-20]] as number[][]){const a=transform(x,y1),b=transform(x,y2);g.lineStyle(thick,0xffffff,alpha);g.lineBetween(a.x,a.y,b.x,b.y);}
    const bottomA=transform(-w*.5,h-4),bottomB=transform(w*.5,h-4);g.lineStyle(2,0xe2ecff,.30);g.lineBetween(bottomA.x,bottomA.y,bottomB.x,bottomB.y);
    const uniform=total===4&&layers.every(l=>l.color===layers[0].color);
    const corkTarget=selected||this.busyTube(index)?1:0,previous=this.corkOpen.get(index)??corkTarget;
    let opening=previous+(corkTarget-previous)*(1-Math.exp(-this.frameStep/.045));if(Math.abs(opening-corkTarget)<.008)opening=corkTarget;
    this.corkOpen.set(index,opening);
    if(uniform&&Math.abs(angle)<.01&&opening<1&&!this.busyTube(index)){
      const burst=[...this.bursts].reverse().find(b=>b.index===index),elapsed=burst?now-burst.start:10000;
      // A newly completed tube gets a cork; reloaded completions retain their settled cork.
      const drop=elapsed<240?-Math.exp(-elapsed/55)*Math.cos(elapsed/27)*6:0;
      const cw=r.w*.88,ch=Math.max(10,r.w*.27),cx=r.x+opening*10,cy=r.y-ch*.72+drop-opening*23,opacity=1-opening;
      g.fillStyle(0x081425,.30*opacity);g.fillEllipse(cx,r.y+2,r.w*.92,5);
      g.fillStyle(0x916039,opacity);g.fillRoundedRect(cx-cw/2,cy,cw,ch,3);
      g.fillStyle(0xce9a59,opacity);g.fillRoundedRect(cx-cw/2,cy,cw,ch*.62,3);
      g.fillStyle(0xe9bd7b,opacity);g.fillEllipse(cx,cy+1,cw,Math.max(4,ch*.36));
      g.lineStyle(1,0x734624,.5*opacity);g.lineBetween(cx-cw*.33,cy+ch*.72,cx+cw*.33,cy+ch*.72);
      for(let k=0;k<4;k++){g.fillStyle(0x754528,.42*opacity);g.fillCircle(cx-cw*.32+k*cw*.20,cy+ch*(k%2?.4:.65),.8);}
    }
    return {poly,transform};
  }
  update(){
    if(!this.ink)return;
    const now=performance.now(),dt=Math.min(.035,(now-this.lastFrame)/1000||.016);this.lastFrame=now;this.frameStep=dt;
    const signature=JSON.stringify([this.board,this.selected,this.hintMove,this.queuedMove,this.symbols,this.light,this.viewWidth,this.viewHeight]);
    const settling=[...this.selectionY].some(([i,y])=>Math.abs(y-((this.selected===i||this.hintMove?.from===i)&&!this.busyTube(i)?-17:0))>.1);
    const activeSettle=[...this.settles.values()].some(t=>now-t<650),shaking=[...this.pulses.values()].some(t=>now-t<220);
    const corkAnimating=[...this.corkOpen.values()].some(v=>v>0&&v<1);
    if(!this.flight&&!corkAnimating&&!settling&&!shaking&&!activeSettle&&!this.bursts.length&&!this.particles.length&&now-this.entrance>260&&signature===this.previousSignature)return;
    this.previousSignature=signature;this.hitPolygons.clear();this.ink.clear();this.fx.clear();for(const l of this.queueLabels)l.setVisible(false);for(const l of this.activeLabels){l.setVisible(false);this.labels.push(l);}this.activeLabels=[];
    const poses=this.positions(),f=this.flight;
    const frame=f?pourFrame(now-f.start,f.timing):{t:0,remaining:0,tail:-1},t=frame.t,transfer=f?pourTransfer(t):0;
    if(f&&t>=.73&&!f.received){f.received=true;this.land(f.to,f.amount);}
    if(f&&t>=.25&&!this.startedSound){this.startedSound=true;if(t<.73)this.onPour(frame.remaining,(f.before[f.to].length+f.amount*transfer)/4,(f.before[f.to].length+f.amount)/4);}
    for(let i=0;i<this.board.length;i++){
      if(f&&i===f.from)continue;
      const r={...poses[i]},chosen=this.selected===i||this.hintMove?.from===i;
      const target=!this.queuedMove&&(this.selected!==null&&!!moveFor(this.board,this.selected,i)||this.hintMove?.to===i);
      const aim=chosen&&!this.busyTube(i)?-17:0,prev=this.selectionY.get(i)??0;let velocity=this.selectionV.get(i)??0;velocity+=((aim-prev)*520-velocity*28)*dt;let offset=prev+velocity*dt;if(Math.abs(offset-aim)<.04&&Math.abs(velocity)<.2){offset=aim;velocity=0;}this.selectionY.set(i,offset);this.selectionV.set(i,velocity);r.y+=offset;
      if(now-this.entrance<240){const p=Math.max(0,1-(now-this.entrance)/240);r.y+=p*p*12;}
      let ls=grouped(f?f.before[i]:this.board[i]);
      if(f&&i===f.to){const last=ls.at(-1);if(last?.color===f.color)last.amount+=f.amount*transfer;else ls.push({color:f.color,amount:f.amount*transfer});if(t<.73){this.settles.set(i,now);this.impulses.set(i,.6+f.amount*.15);}}
      this.restingTube(r,ls,chosen,target,i,now);
      if(target){const color=this.light?0x23649b:0xa6e8ff;this.fx.lineStyle(2,color,.8);this.fx.strokeEllipse(r.x,r.y+r.h+10,r.w*1.25,9);if(this.hintMove?.to===i){const y=r.y-12;this.fx.lineStyle(2.5,color,1);this.fx.beginPath();this.fx.moveTo(r.x,y-9);this.fx.lineTo(r.x,y+2);this.fx.moveTo(r.x-4,y-2);this.fx.lineTo(r.x,y+2);this.fx.lineTo(r.x+4,y-2);this.fx.strokePath();}}
    }
    if(f){
      const origin=poses[f.from],dest=poses[f.to];
      const r=pourPose(origin,dest,t,this.viewWidth,this.viewHeight,f.lifted,f.plan),angle=r.angle,tipX=r.tipX;
      const ls=grouped(f.before[f.from]);let remaining=f.amount*transfer;for(let i=ls.length-1;i>=0&&remaining>0;i--){const q=Math.min(ls[i].amount,remaining);ls[i].amount-=q;remaining-=q;}
      const {transform}=this.tube(r,ls,angle,true,false,f.from,now);
      if(t>=.25&&t<.73){
        const lip=transform(tipX,0),endY=dest.y+surface(vesselPolygon(dest.w,dest.h),(f.before[f.to].length+f.amount*transfer)*LIQUID_FILL/4),color=COLORS[f.color];
        const stream:Point[]=[];for(let k=0;k<=18;k++){const v=k/18;stream.push({x:Phaser.Math.Linear(lip.x,dest.x,v)+Math.sin(v*Math.PI)*Math.sin(now/60)*1.1,y:Phaser.Math.Linear(lip.y,Math.max(dest.y+5,endY),v)});}
        const taper=Math.min(1,Math.max(.12,(1-transfer)*7),Math.max(.12,transfer*10));
        for(const [width,alpha,col]of [[(7+f.amount*1.3)*taper,.07,color],[(3.6+f.amount*.8)*taper,.95,color],[Math.max(.6,1.2*taper),.65,0xffffff]]){this.fx.lineStyle(width,col,alpha);this.fx.strokePoints(stream,false);}
        for(let n=0;n<5;n++){const phase=((now/260)+n*.2)%1;this.fx.fillStyle(blend(color,0xffffff,.3),1-phase);this.fx.fillEllipse(dest.x+Math.sin(n*2.4+now/120)*phase*14,endY-Math.sin(phase*Math.PI)*13,2.5*(1-phase)+1,4*(1-phase)+1);}
        this.fx.lineStyle(1.5,0xffffff,.45);this.fx.strokeEllipse(dest.x,endY+2,9+Math.sin(now/40)*4,3);
      }
      if(frame.tail>=0&&frame.tail<Math.min(58,f.timing.back*.7)){
        const q=frame.tail/Math.min(58,f.timing.back*.7),end=pourPose(origin,dest,.73,this.viewWidth,this.viewHeight,0,f.plan);
        const lip={x:end.x+end.tipX*Math.cos(end.angle),y:end.y+end.tipX*Math.sin(end.angle)},endY=dest.y+surface(vesselPolygon(dest.w,dest.h),(f.before[f.to].length+f.amount)*LIQUID_FILL/4);
        this.fx.fillStyle(blend(COLORS[f.color],0xffffff,.25),1-q*.5);this.fx.fillEllipse(Phaser.Math.Linear(lip.x,dest.x,q),Phaser.Math.Linear(lip.y,endY,q*q),2.5,4*(1-q)+2);
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
    this.bursts=this.bursts.filter(b=>now-b.start<650);
    for(const b of this.bursts){const r=poses[b.index],p=(now-b.start)/650,fade=Math.pow(1-p,1.7),g=this.fx;
      for(let n=3;n>=1;n--){g.fillStyle(b.color,.035*fade);g.fillEllipse(r.x,r.y+r.h*.5,r.w*(1+n*.6),r.h*(1+n*.1));}
      g.lineStyle(2,b.color,.8*fade);g.strokeEllipse(r.x,r.y+r.h*.45,r.w*(.9+p*2.2),r.h*(.35+p*.6));
      const sweep=r.y+r.h*(1-p);g.lineStyle(3,0xffffff,.75*fade);g.lineBetween(r.x-r.w*.4,sweep,r.x+r.w*.4,sweep);
      for(let n=0;n<3;n++){const a=n*Math.PI*2/3+p*.8;this.star(r.x+Math.cos(a)*r.w*(.6+p*.35),r.y+r.h*.35+Math.sin(a)*r.h*.3,3*fade,0xfff5ce,fade,a);}
    }
    this.particles=this.particles.filter(p=>p.age<p.life);
    for(const p of this.particles){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=165*dt;const fade=Math.max(0,1-p.age/p.life);this.fx.fillStyle(p.color,fade*.8);this.fx.fillEllipse(p.x,p.y,p.size*fade,p.size*fade*1.5);}
  }
}
