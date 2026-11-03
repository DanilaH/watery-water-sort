import {extraCount,extraFields,validExtras,scoreMoves,type Shuffle} from './assist';
import {goalStart} from './goalStart';
import {emptyWallet,validWallet,type Wallet} from './economy';
import levelData from './levels.json' with {type:'json'};
import legacyData from './levels-v1.json' with {type:'json'};
import { clone, validBoard, won, type Board, type Move, type Goal, goalList, type Goals, transition, iceOpen } from './rules';
import {walk,validKnowledge,knowledgeView} from './knowledge';
import {isTheme,type ThemeId} from './themes';
export type Level={id:string;version:number;colors:number;seed:number;initial:Board;witness:Move[];goal?:Goal;goals?:Goal[];mini?:number;ice?:number;hidden?:{index:number;layers:number[]}[]};
export const levels=levelData as Level[];
/** Historical boards remain replayable; newest content is used only for a genuinely new attempt. */
export const allLevels=[...new Map([...(legacyData as Level[]),...levels].map(l=>[`${l.id}@${l.version}`,l])).values()];
export const levelByKey=(key:string)=>allLevels.find(l=>`${l.id}@${l.version}`===key);
export function levelFor(s:Pick<Save,'current'|'attempts'>,index=s.current):Level{
 const latest=levels[index];return allLevels.filter(l=>l.id===latest.id&&s.attempts[`${l.id}@${l.version}`]).sort((a,b)=>b.version-a.version)[0]??latest;
}
export const activeKey=(s:Pick<Save,'current'|'attempts'>,index=s.current)=>{const l=levelFor(s,index);return `${l.id}@${l.version}`;};
export const levelGoals=(l:Level,thawed=false):Goals|undefined=>l.mini===undefined&&l.ice===undefined?l.goals??l.goal:{goals:goalList(l.goals??l.goal),...(l.mini!==undefined?{mini:l.mini}:{}),...(l.ice!==undefined?{ice:l.ice,thawed}:{})};
export const goalFor=(s:Pick<Save,'current'|'attempts'>)=>levelGoals(levelFor(s),attempt(s).thawed===true);
export type Attempt = { board: Board; history: Move[]; extra: boolean; extras?:number;shuffles?:Shuffle[]; setup?:number; thawed?:boolean;known?:number[] };
export type Settings = { sound: boolean; fast: boolean; symbols: boolean; light: boolean; haptics?: boolean; theme?:ThemeId };
export type Best = {history:Move[];extra:boolean;extras?:number;shuffles?:Shuffle[];setup?:number};
export type Save = { wallet?:Wallet; best?:Record<string,Best>; schema: 1; campaignVersion?:1; unlocked?:string[]; artVersion?: number; current: number; revision: number; completed: string[]; attempts: Record<string,Attempt>; settings: Settings };
export function fresh(): Save { return { wallet:emptyWallet(),schema:1,campaignVersion:1,artVersion:4,best:{},current:0,revision:0,completed:[],attempts:{},settings:{sound:true,fast:false,symbols:false,light:false} }; }
export const levelKey = (i: number) => `${levels[i].id}@${levels[i].version}`;
export function attempt(s:Pick<Save,'current'|'attempts'>): Attempt { return s.attempts[activeKey(s)] ?? {board:clone(levelFor(s).initial),history:[],extra:false}; }
/** Replay is the authority for both liquid and earned access, including Undo. */
export function replay(l:Level,history:Move[],extra:boolean|number,shuffles:Shuffle[]=[]):Attempt{
 const result=walk(l,history,extra,levelGoals(l),shuffles);
 return {board:result.board,history:structuredClone(history),...extraFields(Number(extra)),...(shuffles.length?{shuffles:structuredClone(shuffles)}:{}),...(l.ice!==undefined?{thawed:iceOpen(result.rules)}:{}),...(l.hidden?{known:result.learned}:{})};
}
function validSetup(l:Level,a:{history:Move[];setup?:number;shuffles?:Shuffle[]}){
 if(a.shuffles?.some(e=>e.at<(a.setup??0)))return false;
 if(a.setup===undefined)return true;const prefix=goalStart(l);return prefix.length>0&&a.setup===prefix.length&&a.history.length>=prefix.length&&prefix.every((m,i)=>{const actual=a.history[i];return actual&&actual.from===m.from&&actual.to===m.to&&actual.amount===m.amount&&actual.color===m.color;});
}
export function validSave(value: unknown): value is Save {
  try {
    const s=value as Save;
    if(s.wallet!==undefined&&!validWallet(s.wallet))return false;
    if(s.schema!==1 || !Number.isInteger(s.current) || s.current<0 || s.current>=levels.length || !Number.isSafeInteger(s.revision) || s.revision<0) return false;
    if(s.campaignVersion!==undefined&&s.campaignVersion!==1)return false;
    if(s.unlocked!==undefined&&(!Array.isArray(s.unlocked)||new Set(s.unlocked).size!==s.unlocked.length||!s.unlocked.every(id=>levels.some(l=>l.id===id))))return false;
    if(!Array.isArray(s.completed) || !s.completed.every(id=>levels.some(l=>l.id===id)))return false;
    if(s.settings?.haptics!==undefined&&typeof s.settings.haptics!=='boolean')return false;
    if(s.settings?.theme!==undefined&&!isTheme(s.settings.theme))return false;
    if(!s.settings || !['sound','fast','symbols','light'].every(k=>typeof s.settings[k as keyof Settings]==='boolean'))return false;
    if(!s.attempts || typeof s.attempts!=='object')return false;
    for(const [key,a] of Object.entries(s.attempts)) {
      const l=levelByKey(key); if(!l || !validBoard(a.board,levelGoals(l,a.thawed===true)) || typeof a.extra!=='boolean' || !Array.isArray(a.history))return false;
      if(a.thawed!==undefined&&(typeof a.thawed!=='boolean'||l.ice===undefined))return false;
      if(!validExtras(a)||!validSetup(l,a))return false;
      const expected=replay(l,a.history,extraCount(a),a.shuffles);
      if(JSON.stringify(expected.board)!==JSON.stringify(a.board)||!!expected.thawed!==!!a.thawed||!validKnowledge(l,a.known,expected.known??[]))return false;
    }
    if(s.best!==undefined){
      if(!s.best||typeof s.best!=='object'||Array.isArray(s.best))return false;
      for(const [key,r]of Object.entries(s.best)){
        const l=levelByKey(key);if(!l||!r||typeof r.extra!=='boolean'||!Array.isArray(r.history))return false;
        if(!validExtras(r)||!validSetup(l,r))return false;const result=replay(l,r.history,extraCount(r),r.shuffles);if(!won(result.board,levelGoals(l,result.thawed)))return false;
      }
    }
    return true;
  }catch{return false;}
}
export function moved(s:Save,m:Move):Save {const n=structuredClone(s), a=attempt(n); const result=transition(a.board,m,goalFor(n));a.board=result.board;if(levelFor(n).ice!==undefined)a.thawed=iceOpen(result.rules);a.history.push(m);if(levelFor(n).hidden)a.known=[...new Set([...(a.known??[]),...walk(levelFor(n),a.history,extraCount(a),levelGoals(levelFor(n)),a.shuffles).learned])].sort((a,b)=>a-b);n.attempts[activeKey(n)]=a;n.revision++;
 if(won(a.board,goalFor(n))){if(!n.completed.includes(levelFor(n).id))n.completed.push(levelFor(n).id);const key=activeKey(n);n.best??={};if(!n.best[key]||scoreMoves(n.best[key])>scoreMoves(a))n.best[key]={history:structuredClone(a.history),...extraFields(extraCount(a)),...(a.shuffles?{shuffles:structuredClone(a.shuffles)}:{}),...(a.setup!==undefined?{setup:a.setup}:{})};}
 return n;}
export function undone(s:Save):Save {
 const n=structuredClone(s),a=attempt(n),events=structuredClone(a.shuffles??[]),last=events.at(-1);
 if(last?.at===a.history.length)events.pop();else if(a.history.length>(a.setup??0))a.history.pop();else return s;
 const result={...replay(levelFor(n),a.history,extraCount(a),events),...(a.setup!==undefined?{setup:a.setup}:{})};
 if(levelFor(n).hidden)result.known=[...new Set([...(a.known??[]),...(result.known??[])])].sort((a,b)=>a-b);
 n.attempts[activeKey(n)]=result;n.revision++;return n;
}
export function restarted(s:Save):Save {
 const n=structuredClone(s),old=attempt(n),count=extraCount(old),board=clone(levelFor(n).initial);for(let i=0;i<count;i++)board.push([]);
 n.attempts[activeKey(n)]={board,history:[],...extraFields(count),...(levelFor(n).hidden?{known:[...(old.known??[])]}:{})};n.revision++;return n;
}
/** Legacy API remains an idempotent first entitlement for old receipts. */
export function expanded(s:Save):Save {if(attempt(s).extra)return s;const n=structuredClone(s),a=attempt(n);a.extra=true;a.board.push([]);n.attempts[activeKey(n)]=a;n.revision++;return n;}
export function offerExtra(s:Save){return levelFor(s).colors>2&&extraCount(attempt(s))<3;}
export function displaySlots(s:Save){return attempt(s).board.length;}
/** A numbered entitlement makes retries and delayed receipts idempotent. */
export function grantExtra(s:Save,key:string,number=1):Save{
 const l=levelByKey(key);if(!l||l.colors<=2||!Number.isInteger(number)||number<1||number>3)throw Error('Invalid reward level');
 const n=structuredClone(s),a=n.attempts[key]??{board:clone(l.initial),history:[],extra:false};
 if(extraCount(a)>=number)return s;
 for(let i=extraCount(a);i<number;i++)a.board.push([]);Object.assign(a,extraFields(number));n.attempts[key]=a;n.revision++;return n;
}
export function reshuffled(s:Save,event:Shuffle):Save{
 const n=structuredClone(s),a=attempt(n);if(event.at!==a.history.length||(a.shuffles?.length??0)>=64)throw Error('Stale shuffle');
 const result=replay(levelFor(n),a.history,extraCount(a),[...(a.shuffles??[]),event]);
 result.setup=a.setup;if(levelFor(n).hidden)result.known=[...new Set([...(a.known??[]),...(result.known??[])])].sort((a,b)=>a-b);
 n.attempts[activeKey(n)]=result;n.revision++;return n;
}

/** Recover only provable previous results; completion without a retained path earns no invented record. */
export function migrateBest(s:Save):Save{
 const n=structuredClone(s);n.best??={};
 for(const [key,a]of Object.entries(n.attempts))if(won(a.board,levelGoals(levelByKey(key)!,a.thawed))&&(!n.best[key]||scoreMoves(n.best[key])>scoreMoves(a)))n.best[key]={history:structuredClone(a.history),...extraFields(extraCount(a)),...(a.shuffles?{shuffles:structuredClone(a.shuffles)}:{}),...(a.setup!==undefined?{setup:a.setup}:{})};
 return n;
}

export const knowledgeFor=(s:Pick<Save,'current'|'attempts'>)=>knowledgeView(levelFor(s),attempt(s),levelGoals(levelFor(s)));

/** Used for a new UI attempt only. Existing attempts are resumed byte-for-byte. */
export function seededRestart(s:Save):Save{
 const n=restarted(s),prefix=goalStart(levelFor(n));
 if(prefix.length){const a=attempt(n),result=replay(levelFor(n),prefix,extraCount(a));result.setup=prefix.length;
 if(levelFor(n).hidden)result.known=[...new Set([...(a.known??[]),...(result.known??[])])].sort((a,b)=>a-b);
 n.attempts[activeKey(n)]=result;}
 return n;
}

/** Explicit map selection / Next uses the latest board; old attempts and records are archived intact. */
export function startLatest(s:Save):Save{
 if(levelFor(s).version===levels[s.current].version)return seededRestart(s);
 const n=structuredClone(s),l=levels[n.current];
 n.attempts[levelKey(n.current)]={board:clone(l.initial),history:[],extra:false};
 return seededRestart(n);
}
