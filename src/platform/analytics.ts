import {Capacitor,registerPlugin} from '@capacitor/core';
export type EventName='level_start'|'level_resume'|'tutorial_complete'|'save_recovered'|'extra_tube_offer'|'level_complete'|'level_leave'|'level_restart'|'undo'|'hint_request'|'hint_result'|'reward_request'|'reward_result'|'reward_granted'|'save_error'|'hint_spent'|'hint_shop'|'hint_purchase'|'coins_earned'|'interstitial_request'|'interstitial_result'|'shuffle_request'|'shuffle_result'|'boost_spent'|'boost_purchase';
export type EventData={level:string;stage:number;moves:number;extra:boolean;revision:number;reason?:string;status?:string;stars?:number;first?:boolean;active_ms?:number;amount?:number;balance?:number;hints?:number};
export type GameEvent={name:EventName;data:EventData};
const native=registerPlugin<{event(e:GameEvent):Promise<void>}>('WaterAnalytics');
/** Bounded preview diagnostics, no board, ad token, user ID or durable queue. */
export class Analytics{
 readonly recent:GameEvent[]=[];
 private pending=0;
 emit(name:EventName,data:EventData){
  const keys=['level','stage','moves','extra','revision','reason','status','stars','first','active_ms','amount','balance','hints'] as const;
  const event={name,data:Object.fromEntries(keys.filter(k=>data[k]!==undefined).map(k=>[k,data[k]])) as EventData};this.recent.push(event);if(this.recent.length>100)this.recent.shift();
  if(!Capacitor.isNativePlatform()||this.pending>=8)return;
  this.pending++;try{void native.event(event).catch(()=>{}).finally(()=>{this.pending--;});}catch{this.pending--;}
 }
}
