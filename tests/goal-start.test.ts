import {test,expect} from 'vitest';
import {goalStart,playerMoves} from '../src/core/goalStart';
import {fresh,levels,levelKey,levelGoals,goalFor,attempt,moved,undone,seededRestart,replay,validSave,expanded,migrateBest} from '../src/core/session';
import {goalList,validBoard,moves,won} from '../src/core/rules';
import {solveHint} from '../src/core/hintSolver';import {stars,targets} from '../src/core/ratings';
import {SaveStore} from '../src/platform/storage';import {settleEconomy} from '../src/core/economy';import proof from '../docs/audits/campaign-balance-47/prepared.json';import legacyProof from '../docs/audits/campaign-balance-47/optimal.json';
test('all 120 prepared boards conserve liquid, have zero player moves and keep exact star targets',()=>{
 for(const p of proof){let s={...fresh(),current:p.level};if(p.extra)s=expanded(s);s=seededRestart(s);const a=attempt(s),l=levels[p.level],prefix=goalStart(l);
 expect(validSave(s)).toBe(true);expect(validBoard(a.board,goalFor(s))).toBe(true);expect(a.board.flat().sort()).toEqual(l.initial.flat().sort());expect(playerMoves(a)).toBe(0);expect(a.history).toEqual(prefix);
 for(const g of goalList(levelGoals(l))){expect(a.board[g.index].length).toBeGreaterThan(0);expect(a.board[g.index].every(c=>c===g.color)).toBe(true);}
 expect(undone(s)).toEqual(s);expect(legacyProof.find(r=>r.level===p.level&&r.extra===p.extra)!.optimal).toBe(p.optimal+p.setup);if(!p.extra)expect(targets(levelKey(p.level)).three).toBe(p.optimal+p.setup);
 for(const m of p.path)s=moved(s,m);
 expect(won(attempt(s).board,goalFor(s))).toBe(true);expect(playerMoves(attempt(s))).toBe(p.optimal);expect(stars(levelKey(p.level),attempt(s).history.length)).toBe(3);expect(validSave(s)).toBe(true);
 if(prefix.length){expect(s.best![levelKey(p.level)].setup).toBe(prefix.length);expect(migrateBest(s)).toEqual(s);const reset=seededRestart(s);expect(attempt(reset).board).toEqual(a.board);expect(playerMoves(attempt(reset))).toBe(0);expect(reset.best).toEqual(s.best);}
 }
});
test('the real hint planner follows an optimal route from every prepared initial board with and without a buffer',()=>{
 for(const p of proof.filter(p=>p.setup)){let s={...fresh(),current:p.level};if(p.extra)s=expanded(s);s=seededRestart(s);const r=solveHint(attempt(s).board,goalFor(s),levelKey(p.level),!!p.extra);
 expect(r.status).toBe('FOUND');if(r.status==='FOUND'){expect(r.nodes).toBe(0);expect(r.path).toHaveLength(p.optimal);for(const m of r.path)s=moved(s,m);expect(won(attempt(s).board,goalFor(s))).toBe(true);}
 }
});
test('saved legacy games, records and coin awards survive loading unchanged',()=>{
 let s={...fresh(),current:12};s.attempts[levelKey(12)]=replay(levels[12],[],false);let raw=JSON.stringify(s);const store=new SaveStore({getItem:()=>raw,setItem:(_,v)=>{raw=v;}});let loaded=store.load().state;expect(attempt(loaded)).toEqual(attempt(s));expect(playerMoves(attempt(loaded))).toBe(0);
 for(const m of levels[12].witness)loaded=moved(loaded,m);loaded=settleEconomy(loaded);expect(loaded.wallet!.coins).toBe(30);raw=JSON.stringify(loaded);const again=store.load().state;expect(again.best).toEqual(loaded.best);expect(again.wallet).toEqual(loaded.wallet);expect(attempt(again)).toEqual(attempt(loaded));
 const seeded=seededRestart(again);expect(seeded.best).toEqual(again.best);expect(settleEconomy(seeded).wallet).toEqual(again.wallet);
});
test('Undo stops at setup, restarts retain the buffer and setup metadata cannot forge a path',()=>{
 const s=seededRestart(expanded({...fresh(),current:13})),m=moves(attempt(s).board,goalFor(s))[0],next=moved(s,m);
 expect(playerMoves(attempt(next))).toBe(1);expect(attempt(undone(next))).toEqual(attempt(s));expect(attempt(undone(undone(next)))).toEqual(attempt(s));expect(attempt(seededRestart(next)).extra).toBe(true);
 for(const value of [-1,0,2,1.5,999]){const bad=structuredClone(s);attempt(bad).setup=value;expect(validSave(bad)).toBe(false);}
 const bad=structuredClone(s);attempt(bad).history=[];expect(validSave(bad)).toBe(false);
});
