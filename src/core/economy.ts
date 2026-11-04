import type {Save} from './session';
import {levels,activeKey,attempt} from './session';
import {earnedStars} from './progress';
import type {Move} from './rules';
export const ECONOMY={star:10,startHints:3,packHints:3,packPrice:60,adCoins:80,startTubes:3} as const;
export type Wallet={version:1;coins:number;hints:number;shuffles?:number;tubes?:number;awarded:Record<string,number>;receipts:string[];adOrder?:string;adAfter?:number;adAttemptAfter?:number;hintAdvice?:{key:string;move:Move}};
export const emptyWallet=():Wallet=>({version:1,coins:0,hints:ECONOMY.startHints,shuffles:ECONOMY.startHints,tubes:ECONOMY.startTubes,awarded:{},receipts:[]});
const integer=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
export function validWallet(w:Wallet){return !!w&&w.version===1&&integer(w.coins)&&integer(w.hints)&&(w.shuffles===undefined||integer(w.shuffles))&&(w.tubes===undefined||integer(w.tubes))&&!!w.awarded&&typeof w.awarded==='object'&&!Array.isArray(w.awarded)&&Object.entries(w.awarded).every(([id,n])=>levels.some(l=>l.id===id)&&integer(n)&&n<=3)&&Array.isArray(w.receipts)&&w.receipts.every(t=>typeof t==='string'&&t.length>0&&t.length<=100)&&new Set(w.receipts).size===w.receipts.length&&[w.adAfter,w.adAttemptAfter].every(v=>v===undefined||integer(v))&&(w.adOrder===undefined||/^coins:[a-zA-Z0-9-]{1,80}$/.test(w.adOrder))&&(w.hintAdvice===undefined||typeof w.hintAdvice.key==='string'&&w.hintAdvice.key.length<=4096&&!!w.hintAdvice.move&&['from','to','amount','color'].every(k=>integer(w.hintAdvice!.move[k as keyof Move])));}
/** Award only the new high-water mark; called inside the same durable game transaction. */
export function settleEconomy(s:Save):Save{
 const n=structuredClone(s);n.wallet??=emptyWallet();n.wallet.tubes??=ECONOMY.startTubes;n.wallet.shuffles??=n.wallet.hints;
 for(let i=0;i<levels.length;i++){const l=levels[i],earned=earnedStars(n,i);const old=n.wallet.awarded[l.id]??0;if(earned>old){n.wallet.coins+=(earned-old)*ECONOMY.star;n.wallet.awarded[l.id]=earned;}}
 return n;
}
export const purchaseHints=(s:Save)=>purchaseBoost(s,'hint');
export const adviceKey=(s:Save)=>{const a=attempt(s);return JSON.stringify([activeKey(s),a.board,!!a.thawed,a.known??[]]);};
export function ownHint(s:Save,key:string,move:Move,free=false):Save|undefined{
 if(s.wallet?.hintAdvice?.key===key){if(['from','to','color','amount'].every(k=>s.wallet!.hintAdvice!.move[k as keyof Move]===move[k as keyof Move]))return s;const n=structuredClone(s);n.wallet!.hintAdvice={key,move:{...move}};n.revision++;return n;}
 if(!s.wallet||!free&&!s.wallet.hints)return;
 const n=structuredClone(s);n.wallet!.shuffles??=boostStock(s.wallet,'shuffle');if(!free)n.wallet!.hints--;n.wallet!.hintAdvice={key,move:{...move}};n.revision++;return n;
}
export function creditCoins(s:Save,token:string,order:string):Save|undefined{
 if(!s.wallet)return;
 if(s.wallet.receipts.includes(token))return s;
 // Native earned receipts remain authoritative even if recovery used a pre-offer backup.
 // Deduplicate the durable effect before acknowledging; never depend on the open dialog.
 if(!/^coins:[a-zA-Z0-9-]{1,80}$/.test(order))return;
 const n=structuredClone(s);n.wallet!.coins+=ECONOMY.adCoins;n.wallet!.receipts.push(token);if(n.wallet!.adOrder===order)delete n.wallet!.adOrder;n.revision++;return n;
}

export type Boost='hint'|'shuffle'|'tube';
export const boostStock=(w:Wallet,kind:Boost)=>kind==='hint'?w.hints:kind==='shuffle'?w.shuffles??w.hints:w.tubes??ECONOMY.startTubes;
const boostFields={hint:'hints',shuffle:'shuffles',tube:'tubes'} as const;
export function purchaseBoost(s:Save,kind:Boost):Save|undefined{
 if(!s.wallet||s.wallet.coins<ECONOMY.packPrice)return;const n=structuredClone(s);n.wallet!.coins-=ECONOMY.packPrice;
 n.wallet!.shuffles??=boostStock(s.wallet,'shuffle');
 n.wallet![boostFields[kind]]=boostStock(s.wallet,kind)+ECONOMY.packHints;n.revision++;return n;
}
export function spendBoost(s:Save,kind:Boost):Save|undefined{
 if(!s.wallet)return;const count=boostStock(s.wallet,kind);if(!count)return;
 const n=structuredClone(s);n.wallet!.shuffles??=boostStock(s.wallet,'shuffle');
 n.wallet![boostFields[kind]]=count-1;n.revision++;return n;
}
export function tubeTarget(key:string,number:number){return `tube:${key}:${number}`;}
export function parseTubeTarget(target:string){const m=/^tube:(water-\d{3}@\d+):([123])$/.exec(target);return m?{key:m[1],number:Number(m[2])}:/^water-\d{3}@\d+$/.test(target)?{key:target,number:1}:undefined;}
