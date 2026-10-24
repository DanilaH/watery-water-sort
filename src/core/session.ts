import levels from './levels.json';
import { apply, clone, reverse, validBoard, type Board, type Move } from './rules';
export { levels };
export type Attempt = { board: Board; history: Move[]; extra: boolean };
export type Settings = { sound: boolean; fast: boolean; symbols: boolean; light: boolean; haptics?: boolean };
export type Save = { schema: 1; current: number; revision: number; completed: string[]; attempts: Record<string,Attempt>; settings: Settings };
export function fresh(): Save { return { schema:1,current:0,revision:0,completed:[],attempts:{},settings:{sound:true,fast:false,symbols:false,light:true} }; }
export const levelKey = (i: number) => `${levels[i].id}@${levels[i].version}`;
export function attempt(s: Save): Attempt { return s.attempts[levelKey(s.current)] ?? {board:clone(levels[s.current].initial),history:[],extra:false}; }
export function validSave(value: unknown): value is Save {
  try {
    const s=value as Save;
    if(s.schema!==1 || !Number.isInteger(s.current) || s.current<0 || s.current>=levels.length || !Number.isSafeInteger(s.revision) || s.revision<0) return false;
    if(!Array.isArray(s.completed) || !s.completed.every(id=>levels.some(l=>l.id===id)))return false;
    if(s.settings?.haptics!==undefined&&typeof s.settings.haptics!=='boolean')return false;
    if(!s.settings || !['sound','fast','symbols','light'].every(k=>typeof s.settings[k as keyof Settings]==='boolean'))return false;
    if(!s.attempts || typeof s.attempts!=='object')return false;
    for(const [key,a] of Object.entries(s.attempts)) {
      const l=levels.find(l=>`${l.id}@${l.version}`===key); if(!l || !validBoard(a.board) || typeof a.extra!=='boolean' || !Array.isArray(a.history))return false;
      let b:Board=clone(l.initial);if(a.extra)b.push([]);
      for(const m of a.history)b=apply(b,m);
      if(JSON.stringify(b)!==JSON.stringify(a.board))return false;
    }
    return true;
  }catch{return false;}
}
export function moved(s:Save,m:Move):Save {const n=structuredClone(s), a=attempt(n); a.board=apply(a.board,m);a.history.push(m);n.attempts[levelKey(n.current)]=a;n.revision++;return n;}
export function undone(s:Save):Save {const n=structuredClone(s),a=attempt(n),m=a.history.pop();if(m){a.board=reverse(a.board,m);n.attempts[levelKey(n.current)]=a;n.revision++;}return n;}
export function restarted(s:Save):Save {const n=structuredClone(s),extra=attempt(n).extra; const board=clone(levels[n.current].initial);if(extra)board.push([]);n.attempts[levelKey(n.current)]={board,history:[],extra};n.revision++;return n;}
