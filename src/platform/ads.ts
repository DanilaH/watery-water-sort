import {Capacitor,registerPlugin,type PluginListenerHandle} from '@capacitor/core';
export type InterstitialResult={status:'shown'|'unavailable'|'failed'|'closed'};
const native=registerPlugin<{addListener(eventName:string,listener:()=>void):Promise<PluginListenerHandle>;prepare():Promise<void>;show():Promise<InterstitialResult>;banner(o:{visible:boolean;slot?:{x:number;y:number;width:number;height:number};viewport?:{width:number;height:number}}):Promise<{heightCss?:number;status?:string;safeLeftCss?:number;safeRightCss?:number;safeBottomCss?:number}>}>('WaterAds');
export class Ads{
 readonly native=Capacitor.isNativePlatform();
 private frame=0;private epoch=0;private busy=false;private again=false;private visible=false;private geometry='';private reserved=0;
 constructor(private slot:HTMLElement){
  if(!this.native)return;try{void native.addListener('ready',()=>this.schedule()).catch(()=>{});}catch{}new ResizeObserver(()=>this.schedule()).observe(slot);window.addEventListener('resize',()=>this.schedule());document.addEventListener('visibilitychange',()=>this.schedule());window.addEventListener('scroll',()=>this.schedule(),{passive:true});
 }
 prepare(){this.schedule();if(this.native)try{void native.prepare().catch(()=>{});}catch{}}
 async show():Promise<InterstitialResult>{if(!this.native)return {status:'unavailable'};try{return await native.show();}catch{return {status:'failed'};}}
 banner(visible:boolean){if(this.visible!==visible){this.visible=visible;this.epoch++;this.schedule();}}
 private schedule(){if(this.frame||!this.native)return;this.frame=requestAnimationFrame(()=>{this.frame=0;void this.update();});}
 private async update(){
  if(this.busy){this.again=true;return;}this.busy=true;const epoch=this.epoch;
  try{const r=this.slot.getBoundingClientRect();const geometry=`${innerWidth}x${innerHeight}:${r.width}`;const geometryChanged=geometry!==this.geometry;if(geometryChanged){this.geometry=geometry;this.reserved=0;}const result=await native.banner({visible:this.visible&&!document.hidden,slot:{x:r.x,y:r.y,width:r.width,height:r.height},viewport:{width:innerWidth,height:innerHeight}});
   if(epoch===this.epoch){
    const app=document.getElementById('app')!;
    for(const [side,inset,limit] of [['left',result.safeLeftCss,innerWidth],['right',result.safeRightCss,innerWidth],['bottom',result.safeBottomCss,innerHeight]] as const){
     if(inset===undefined||!Number.isFinite(inset)||inset<0||inset>=limit/3)continue;
     const name=`--banner-safe-${side}`,value=`${inset}px`;
     if(app.style.getPropertyValue(name)!==value){app.style.setProperty(name,value);this.again=true;}
    }
   }
   if(epoch===this.epoch&&result.heightCss&&Number.isFinite(result.heightCss)){// Never shrink a fitted slot on ordinary callbacks: fractional native edge rounding can otherwise oscillate by one CSS pixel.
   if(this.visible&&result.status==='placed'&&!geometryChanged){this.reserved=Math.max(this.reserved,r.height);return;}
   const height=Math.max(this.reserved,Math.ceil(result.heightCss));this.reserved=height;if(height>=1&&height<innerHeight/2&&this.slot.style.getPropertyValue('--banner-height')!==height+'px'){this.slot.style.setProperty('--banner-height',height+'px');document.getElementById('app')!.style.setProperty('--banner-height',height+'px');this.again=true;}}
  }catch{/* Native/no-fill never blocks the game. */}finally{this.busy=false;if(this.again){this.again=false;this.schedule();}}
 }
}
