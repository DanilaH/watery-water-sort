import {test,expect} from 'vitest';
import {levels,fresh,moved,undone,restarted,expanded,attempt,validSave,levelKey,knowledgeFor,levelGoals,goalFor,type Level} from '../src/core/session';
import {validMask,walk,knowledgeView,hasUnknown} from '../src/core/knowledge';
import {visibleHint} from '../src/core/visibleHint';
import {moveFor,won,transition} from '../src/core/rules';
import proof from '../docs/audits/hidden-36/optimal.json';

test('authored masks never cover the top, reject duplicate/dead slots and preserve the first 34 levels',()=>{
 for(const l of levels)expect(validMask(l)).toBe(true);
 const l=levels[34];for(const hidden of [[{index:0,layers:[3]}],[{index:9,layers:[0]}],[{index:0,layers:[-1]}],[{index:0,layers:[0,0]}],[{index:0,layers:[0]},{index:0,layers:[0]}],[]])expect(validMask({...l,hidden})).toBe(false);
 expect(levels.slice(0,34).every(l=>l.hidden===undefined)).toBe(true);
});

test('unit identities follow a maximal pour; newly exposed and transferred masked portions become known',()=>{
 const l:Level={...levels[34],initial:[[0,1,1],[0,0,1,1],[]],hidden:[{index:0,layers:[0,1]},{index:1,layers:[1,2]}]};
 const m=moveFor(l.initial,0,2)!,v=walk(l,[m],false);expect(m.amount).toBe(2);expect(v.ids).toEqual([[0],[8,9,10,11],[1,2]]);expect(v.learned).toEqual([0,1]);
 const view=knowledgeView(l,{board:v.board,history:[m],extra:false,known:v.learned});expect(view?.known).toContain(0);expect(view?.known).not.toContain(9);
});

test('completing a concealed uniform vessel reveals every portion',()=>{
 const l:Level={...levels[34],initial:[[0,0],[0,0],[]],hidden:[{index:0,layers:[0]},{index:1,layers:[0]}]};
 const m=moveFor(l.initial,0,1)!,r=walk(l,[m],false);expect(r.learned).toEqual([0,8]);
});

test('knowledge survives Undo, restart, reselection and JSON reload without retaining scored moves',()=>{
 let s={...fresh(),current:34};for(const m of levels[34].witness.slice(0,4))s=moved(s,m);const known=attempt(s).known!;expect(known.length).toBeGreaterThan(0);
 for(let i=0;i<4;i++)s=undone(s);expect(attempt(s).history).toEqual([]);expect(attempt(s).known).toEqual(known);expect(attempt(s).board).toEqual(levels[34].initial);
 s=restarted(s);expect(attempt(s).known).toEqual(known);expect(validSave(JSON.parse(JSON.stringify(s)))).toBe(true);
 const other={...s,current:0};expect(knowledgeFor(other)).toBeUndefined();expect(knowledgeFor({...other,current:34})?.known).toEqual(knowledgeFor(s)?.known);
});

test('save rejects missing required discoveries, duplicate/outside IDs and knowledge on ordinary levels',()=>{
 let s={...fresh(),current:34};for(const m of levels[34].witness.slice(0,4))s=moved(s,m);expect(validSave(s)).toBe(true);
 for(const known of [[],[999],[-1],[attempt(s).known![0],attempt(s).known![0]],['1']]){const bad=structuredClone(s);(attempt(bad) as any).known=known;expect(validSave(bad)).toBe(false);}
 const old=moved(fresh(),levels[0].witness[0]);(attempt(old) as any).known=[];expect(validSave(old)).toBe(false);
});

test('exploration hint selects the same pair under indistinguishable concealed arrangements',()=>{
 const a:Level={...levels[34],initial:[[0,1,2],[1,0,2],[],[]],hidden:[{index:0,layers:[0,1]},{index:1,layers:[0,1]}]},b={...a,initial:[[1,0,2],[0,1,2],[],[]]};
 const va=knowledgeView(a,{board:a.initial,history:[],extra:false})!,vb=knowledgeView(b,{board:b.initial,history:[],extra:false})!;
 const ma=visibleHint(a.initial,va),mb=visibleHint(b.initial,vb);expect([ma?.from,ma?.to]).toEqual([mb?.from,mb?.to]);expect(hasUnknown(va)).toBe(true);
});

test('all 12 exact hidden paths earn a complete reveal; free exploration does not block three stars',()=>{
 for(const p of proof.filter(p=>p.level>=34)){
  let s={...fresh(),current:p.level};if(p.extra)s=expanded(s);
  for(const m of p.path){s=moved(s,m);const v=knowledgeFor(s)!;expect(v.ids.every((ids,i)=>ids.length===attempt(s).board[i].length)).toBe(true);expect(v.ids.every(ids=>!ids.length||v.known.includes(ids.at(-1)!))).toBe(true);expect(validSave(s)).toBe(true);}
  expect(won(attempt(s).board,goalFor(s))).toBe(true);expect(hasUnknown(knowledgeFor(s))).toBe(false);expect(p.independentNoShorterPath).toBe(true);
  for(const _ of p.path)s=undone(s);expect(attempt(s).history).toHaveLength(0);expect(hasUnknown(knowledgeFor(s))).toBe(false);s=restarted(s);for(const m of p.path)s=moved(s,m);expect(s.best?.[levelKey(s.current)].history.length).toBe(p.optimal);expect(validSave(s)).toBe(true);
 }
});

test('mask is informational: full physics, goal and mini routes and rewarded slot remain unchanged',()=>{
 for(const l of levels.slice(34)){let r={board:l.initial,rules:levelGoals(l)};for(const m of l.witness)r=transition(r.board,m,r.rules);expect(won(r.board,r.rules)).toBe(true);
  const s=expanded({...fresh(),current:levels.indexOf(l)}),v=knowledgeFor(s)!;expect(v.ids.at(-1)).toEqual([]);expect(validSave(restarted(s))).toBe(true);
 }
});
