import levelData from './levels.json' with {type:'json'};
import { clone, validBoard, won, type Board, type Move, type Goal, goalList, type Goals, transition, iceOpen } from './rules';
import {isTheme,type ThemeId} from './themes';
export type Level={id:string;version:number;colors:number;seed:number;initial:Board;witness:Move[];goal?:Goal;goals?:Goal[];mini?:number;ice?:number};
export const levels=levelData as Level[];
export const levelGoals=(l:Level,thawed=false):Goals|undefined=>l.mini===undefined&&l.ice===undefined?l.goals??l.goal:{goals:goalList(l.goals??l.goal),...(l.mini!==undefined?{mini:l.mini}:{}),...(l.ice!==undefined?{ice:l.ice,thawed}:{})};
export const goalFor=(s:Pick<Save,'current'|'attempts'>)=>levelGoals(levels[s.current],attempt(s).thawed===true);
export type Attempt = { board: Board; history: Move[]; extra: boolean; thawed?:boolean };
export type Settings = { sound: boolean; fast: boolean; symbols: boolean; light: boolean; haptics?: boolean; theme?:ThemeId };
export type Best = {history:Move[];extra:boolean};
export type Save = { best?:Record<string,Best>; schema: 1; artVersion?: number; current: number; revision: number; completed: string[]; attempts: Record<string,Attempt>; settings: Settings };
export function fresh(): Save { return { schema:1,artVersion:4,best:{},current:0,revision:0,completed:[],attempts:{},settings:{sound:true,fast:false,symbols:false,light:false} }; }
export const levelKey = (i: number) => `${levels[i].id}@${levels[i].version}`;
export function attempt(s:Pick<Save,'current'|'attempts'>): Attempt { return s.attempts[levelKey(s.current)] ?? {board:clone(levels[s.current].initial),history:[],extra:false}; }
/** Replay is the authority for both liquid and earned access, including Undo. */
export function replay(l:Level,history:Move[],extra:boolean):Attempt{
 let board=clone(l.initial),rules=levelGoals(l);if(extra)board.push([]);
 for(const m of history){const next=transition(board,m,rules);board=next.board;rules=next.rules;}
 return {board,history:structuredClone(history),extra,...(l.ice!==undefined?{thawed:iceOpen(rules)}:{})};
}
export function validSave(value: unknown): value is Save {
  try {
    const s=value as Save;
    if(s.schema!==1 || !Number.isInteger(s.current) || s.current<0 || s.current>=levels.length || !Number.isSafeInteger(s.revision) || s.revision<0) return false;
    if(!Array.isArray(s.completed) || !s.completed.every(id=>levels.some(l=>l.id===id)))return false;
    if(s.settings?.haptics!==undefined&&typeof s.settings.haptics!=='boolean')return false;
    if(s.settings?.theme!==undefined&&!isTheme(s.settings.theme))return false;
    if(!s.settings || !['sound','fast','symbols','light'].every(k=>typeof s.settings[k as keyof Settings]==='boolean'))return false;
    if(!s.attempts || typeof s.attempts!=='object')return false;
    for(const [key,a] of Object.entries(s.attempts)) {
      const l=levels.find(l=>`${l.id}@${l.version}`===key); if(!l || !validBoard(a.board,levelGoals(l,a.thawed===true)) || typeof a.extra!=='boolean' || !Array.isArray(a.history))return false;
      if(a.thawed!==undefined&&(typeof a.thawed!=='boolean'||l.ice===undefined))return false;
      const expected=replay(l,a.history,a.extra);
      if(JSON.stringify(expected.board)!==JSON.stringify(a.board)||!!expected.thawed!==!!a.thawed)return false;
    }
    if(s.best!==undefined){
      if(!s.best||typeof s.best!=='object'||Array.isArray(s.best))return false;
      for(const [key,r]of Object.entries(s.best)){
        const l=levels.find(l=>`${l.id}@${l.version}`===key);if(!l||!r||typeof r.extra!=='boolean'||!Array.isArray(r.history))return false;
        const result=replay(l,r.history,r.extra);if(!won(result.board,levelGoals(l,result.thawed)))return false;
      }
    }
    return true;
  }catch{return false;}
}
export function moved(s:Save,m:Move):Save {const n=structuredClone(s), a=attempt(n); const result=transition(a.board,m,goalFor(n));a.board=result.board;if(levels[n.current].ice!==undefined)a.thawed=iceOpen(result.rules);a.history.push(m);n.attempts[levelKey(n.current)]=a;n.revision++;
 if(won(a.board,goalFor(n))){if(!n.completed.includes(levels[n.current].id))n.completed.push(levels[n.current].id);const key=levelKey(n.current);n.best??={};if(!n.best[key]||n.best[key].history.length>a.history.length)n.best[key]={history:structuredClone(a.history),extra:a.extra};}
 return n;}
export function undone(s:Save):Save {const n=structuredClone(s),a=attempt(n);if(a.history.length){a.history.pop();n.attempts[levelKey(n.current)]=replay(levels[n.current],a.history,a.extra);n.revision++;}return n;}
export function restarted(s:Save):Save {const n=structuredClone(s),extra=attempt(n).extra; const board=clone(levels[n.current].initial);if(extra)board.push([]);n.attempts[levelKey(n.current)]={board,history:[],extra};n.revision++;return n;}

/** Append one tube idempotently; UI callers require a rewarded receipt. Old moves remain replayable. */
export function expanded(s:Save):Save {
 if(attempt(s).extra)return s;
 const n=structuredClone(s),a=attempt(n);a.extra=true;a.board.push([]);
 n.attempts[levelKey(n.current)]=a;n.revision++;return n;
}

/** Metadata for a displayed slot never enters the board or solver. */
export function offerExtra(s:Save){return levels[s.current].colors>2&&!attempt(s).extra;}
export function displaySlots(s:Save){return attempt(s).board.length+Number(offerExtra(s));}
export function grantExtra(s:Save,key:string):Save{
 const i=levels.findIndex((_,i)=>levelKey(i)===key);if(i<0||levels[i].colors<=2)throw Error('Invalid reward level');
 const n=expanded({...s,current:i});return {...n,current:s.current};
}
/** Recover only provable previous results; completion without a retained path earns no invented record. */
export function migrateBest(s:Save):Save{
 const n=structuredClone(s);n.best??={};
 for(const [key,a]of Object.entries(n.attempts))if(won(a.board,levelGoals(levels.find(l=>`${l.id}@${l.version}`===key)!,a.thawed))&&(!n.best[key]||n.best[key].history.length>a.history.length))n.best[key]={history:structuredClone(a.history),extra:a.extra};
 return n;
}
