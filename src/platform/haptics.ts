import {Capacitor,registerPlugin} from '@capacitor/core';
export type Touch='ui'|'select'|'accept'|'color'|'victory'|'collect';
const native=registerPlugin<{impact(options:{event:Touch}):Promise<void>}>('FeelHaptics');
/** No scheduled patterns: each tick belongs to a visible event, never to a backlog. */
export class TouchFeedback{
  enabled=true;
  blocked=false;
  play(event:Touch){
    if(!this.enabled||this.blocked||document.hidden||!Capacitor.isNativePlatform())return;
    void native.impact({event}).catch(()=>{});
  }
}
