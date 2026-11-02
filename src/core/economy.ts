import type {Save} from './session';
import {levels,levelKey,attempt} from './session';
import {stars} from './ratings';
import type {Move} from './rules';
export const ECONOMY={star:10,startHints:3,packHints:3,packPrice:60,adCoins:80} as const;
export type Wallet={version:1;coins:number;hints:number;awarded:Record<string,number>;receipts:string[];adOrder?:string;adAfter?:number;adAttemptAfter?:number;hintAdvice?:{key:string;move:Move}};
export const emptyWallet=():Wallet=>({version:1,coins:0,hints:ECONOMY.startHints,awarded:{},receipts:[]});
const integer=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
export function validWallet(w:Wallet){return !!w&&w.version===1&&integer(w.coins)&&integer(w.hints)&&!!w.awarded&&typeof w.awarded==='object'&&!Array.isArray(w.awarded)&&Object.entries(w.awarded).every(([id,n])=>levels.some(l=>l.id===id)&&integer(n)&&n<=3)&&Array.isArray(w.receipts)&&w.receipts.every(t=>typeof t==='string'&&t.length>0&&t.length<=100)&&new Set(w.receipts).size===w.receipts.length&&[w.adAfter,w.adAttemptAfter].every(v=>v===undefined||integer(v))&&(w.adOrder===undefined||/^coins:[a-zA-Z0-9-]{1,80}$/.test(w.adOrder))&&(w.hintAdvice===undefined||typeof w.hintAdvice.key==='string'&&w.hintAdvice.key.length<=4096&&!!w.hintAdvice.move&&['from','to','amount','color'].every(k=>integer(w.hintAdvice!.move[k as keyof Move])));}
/** Award only the new high-water mark; called inside the same durable game transaction. */
export function settleEconomy(s:Save):Save{
 const n=structuredClone(s);n.wallet??=emptyWallet();
 for(let i=0;i<levels.length;i++){const l=levels[i],b=n.best?.[levelKey(i)],earned=b?stars(levelKey(i),b.history.length):n.completed.includes(l.id)?1:0;const old=n.wallet.awarded[l.id]??0;if(earned>old){n.wallet.coins+=(earned-old)*ECONOMY.star;n.wallet.awarded[l.id]=earned;}}
 return n;
}
export function purchaseHints(s:Save):Save|undefined{if(!s.wallet||s.wallet.coins<ECONOMY.packPrice)return;const n=structuredClone(s);n.wallet!.coins-=ECONOMY.packPrice;n.wallet!.hints+=ECONOMY.packHints;n.revision++;return n;}
export const adviceKey=(s:Save)=>{const a=attempt(s);return JSON.stringify([levelKey(s.current),a.board,!!a.thawed,a.known??[]]);};
export function ownHint(s:Save,key:string,move:Move,free=false):Save|undefined{
 if(s.wallet?.hintAdvice?.key===key){if(['from','to','color','amount'].every(k=>s.wallet!.hintAdvice!.move[k as keyof Move]===move[k as keyof Move]))return s;const n=structuredClone(s);n.wallet!.hintAdvice={key,move:{...move}};n.revision++;return n;}
 if(!s.wallet||!free&&!s.wallet.hints)return;
 const n=structuredClone(s);if(!free)n.wallet!.hints--;n.wallet!.hintAdvice={key,move:{...move}};n.revision++;return n;
}
export function creditCoins(s:Save,token:string,order:string):Save|undefined{
 if(!s.wallet)return;
 if(s.wallet.receipts.includes(token))return s;
 // Native earned receipts remain authoritative even if recovery used a pre-offer backup.
 // Deduplicate the durable effect before acknowledging; never depend on the open dialog.
 if(!/^coins:[a-zA-Z0-9-]{1,80}$/.test(order))return;
 const n=structuredClone(s);n.wallet!.coins+=ECONOMY.adCoins;n.wallet!.receipts.push(token);if(n.wallet!.adOrder===order)delete n.wallet!.adOrder;n.revision++;return n;
}
