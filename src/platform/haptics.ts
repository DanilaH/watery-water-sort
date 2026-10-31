import {Capacitor,registerPlugin} from '@capacitor/core';
export type Touch='ui'|'select'|'accept'|'color'|'victory'|'collect'|'land'|'colorRise'|'colorSeal'|'victoryRise'|'victoryPeak'|'ice'|'reveal';
const native=registerPlugin<{impact(options:{event:Touch;heavy:boolean}):Promise<void>;cancel():Promise<void>}>('FeelHaptics');
/** No scheduled patterns: each tick belongs to a visible event, never to a backlog. */
export class TouchFeedback{
  private active=true;
  private paused=false;
  get enabled(){return this.active;}
  set enabled(value:boolean){if(this.active&&!value)this.cancel();this.active=value;}
  get blocked(){return this.paused;}
  set blocked(value:boolean){if(!this.paused&&value)this.cancel();this.paused=value;}
  private cancel(){if(Capacitor.isNativePlatform())void native.cancel().catch(()=>{});}
  play(event:Touch,heavy=false){
    if(!this.enabled||this.blocked||document.hidden||!Capacitor.isNativePlatform())return;
    void native.impact({event,heavy}).catch(()=>{});
  }
}
