import levels from './levels.json' with {type:'json'};
import { apply, clone, reverse, validBoard, won, type Board, type Move } from './rules';
import {isTheme,type ThemeId} from './themes';
export { levels };
export type Attempt = { board: Board; history: Move[]; extra: boolean };
export type Settings = { sound: boolean; fast: boolean; symbols: boolean; light: boolean; haptics?: boolean; theme?:ThemeId };
export type Best = {history:Move[];extra:boolean};
export type Save = { best?:Record<string,Best>; schema: 1; artVersion?: number; current: number; revision: number; completed: string[]; attempts: Record<string,Attempt>; settings: Settings };
export function fresh(): Save { return { schema:1,artVersion:4,best:{},current:0,revision:0,completed:[],attempts:{},settings:{sound:true,fast:false,symbols:false,light:false} }; }
export const levelKey = (i: number) => `${levels[i].id}@${levels[i].version}`;
export function attempt(s: Save): Attempt { return s.attempts[levelKey(s.current)] ?? {board:clone(levels[s.current].initial),history:[],extra:false}; }
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
      const l=levels.find(l=>`${l.id}@${l.version}`===key); if(!l || !validBoard(a.board) || typeof a.extra!=='boolean' || !Array.isArray(a.history))return false;
      let b:Board=clone(l.initial);if(a.extra)b.push([]);
      for(const m of a.history)b=apply(b,m);
      if(JSON.stringify(b)!==JSON.stringify(a.board))return false;
    }
    if(s.best!==undefined){
      if(!s.best||typeof s.best!=='object'||Array.isArray(s.best))return false;
      for(const [key,r]of Object.entries(s.best)){
        const l=levels.find(l=>`${l.id}@${l.version}`===key);if(!l||!r||typeof r.extra!=='boolean'||!Array.isArray(r.history))return false;
        let b:Board=clone(l.initial);if(r.extra)b.push([]);for(const m of r.history)b=apply(b,m);if(!won(b))return false;
      }
    }
    return true;
  }catch{return false;}
}
export function moved(s:Save,m:Move):Save {const n=structuredClone(s), a=attempt(n); a.board=apply(a.board,m);a.history.push(m);n.attempts[levelKey(n.current)]=a;n.revision++;
 if(won(a.board)){if(!n.completed.includes(levels[n.current].id))n.completed.push(levels[n.current].id);const key=levelKey(n.current);n.best??={};if(!n.best[key]||n.best[key].history.length>a.history.length)n.best[key]={history:structuredClone(a.history),extra:a.extra};}
 return n;}
export function undone(s:Save):Save {const n=structuredClone(s),a=attempt(n),m=a.history.pop();if(m){a.board=reverse(a.board,m);n.attempts[levelKey(n.current)]=a;n.revision++;}return n;}
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
 for(const [key,a]of Object.entries(n.attempts))if(won(a.board)&&(!n.best[key]||n.best[key].history.length>a.history.length))n.best[key]={history:structuredClone(a.history),extra:a.extra};
 return n;
}
