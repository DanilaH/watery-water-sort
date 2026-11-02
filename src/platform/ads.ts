import {Capacitor,registerPlugin,type PluginListenerHandle} from '@capacitor/core';
export type InterstitialResult={status:'shown'|'unavailable'|'failed'|'closed'};
const native=registerPlugin<{addListener(eventName:string,listener:()=>void):Promise<PluginListenerHandle>;prepare():Promise<void>;show():Promise<InterstitialResult>;banner(o:{visible:boolean;slot?:{x:number;y:number;width:number;height:number};viewport?:{width:number;height:number}}):Promise<{heightCss?:number;status?:string}>}>('WaterAds');
export class Ads{
 readonly native=Capacitor.isNativePlatform();
 private frame=0;private epoch=0;private busy=false;private again=false;private visible=false;
 constructor(private slot:HTMLElement){
  if(!this.native)return;void native.addListener('ready',()=>this.schedule()).catch(()=>{});new ResizeObserver(()=>this.schedule()).observe(slot);window.addEventListener('resize',()=>this.schedule());document.addEventListener('visibilitychange',()=>this.schedule());window.addEventListener('scroll',()=>this.schedule(),{passive:true});
 }
 prepare(){this.schedule();if(this.native)void native.prepare().catch(()=>{});}
 async show():Promise<InterstitialResult>{if(!this.native)return {status:'unavailable'};return native.show().catch(()=>({status:'failed' as const}));}
 banner(visible:boolean){if(this.visible!==visible){this.visible=visible;this.epoch++;this.schedule();}}
 private schedule(){if(this.frame||!this.native)return;this.frame=requestAnimationFrame(()=>{this.frame=0;void this.update();});}
 private async update(){
  if(this.busy){this.again=true;return;}this.busy=true;const epoch=this.epoch;
  try{const r=this.slot.getBoundingClientRect();const result=await native.banner({visible:this.visible&&!document.hidden,slot:{x:r.x,y:r.y,width:r.width,height:r.height},viewport:{width:innerWidth,height:innerHeight}});
   if(epoch===this.epoch&&this.visible&&result.heightCss&&Number.isFinite(result.heightCss)){const height=Math.ceil(result.heightCss);if(height>=1&&height<innerHeight/2&&this.slot.style.getPropertyValue('--banner-height')!==height+'px'){this.slot.style.setProperty('--banner-height',height+'px');document.getElementById('app')!.style.setProperty('--banner-height',height+'px');this.again=true;}}
  }catch{/* Native/no-fill never blocks the game. */}finally{this.busy=false;if(this.again){this.again=false;this.schedule();}}
 }
}
