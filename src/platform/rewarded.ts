import {Capacitor,registerPlugin} from '@capacitor/core';
export type Receipt={token:string;level:string};
export type AdResult={status:'rewarded'|'closed'|'unavailable'|'failed';receipt?:Receipt};
const bridge=registerPlugin<{request(o:{level:string}):Promise<AdResult>;pending():Promise<{receipts:Receipt[]}>;ack(o:{token:string}):Promise<void>;cancel():Promise<void>}>('WaterRewarded');
export class Rewarded{
 async request(level:string):Promise<AdResult>{if(!Capacitor.isNativePlatform())return {status:'unavailable'};return bridge.request({level});}
 async pending():Promise<Receipt[]>{if(!Capacitor.isNativePlatform())return [];return (await bridge.pending()).receipts;}
 async ack(token:string){if(Capacitor.isNativePlatform())await bridge.ack({token});}
 async cancel(){if(Capacitor.isNativePlatform())await bridge.cancel();}
}
