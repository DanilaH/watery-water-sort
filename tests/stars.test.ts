import {it,expect} from 'vitest';
import {fresh,levels,levelKey,moved,restarted,undone,attempt,expanded,validSave,migrateBest,grantExtra,displaySlots} from '../src/core/session';
import {moveFor,won} from '../src/core/rules';import {stars,targets} from '../src/core/ratings';
import proof from '../docs/audits/stars-14/optimal.json';
it('all three-star thresholds have independently verified winning paths, with and without an extra tube',()=>{
 for(const p of proof){let s=fresh();s.current=p.level;if(p.extra)s=expanded(s);for(const move of p.path)s=moved(s,move);expect(won(attempt(s).board)).toBe(true);expect(validSave(s)).toBe(true);expect(p.independentNoShorterPath).toBe(true);expect(targets(levelKey(p.level)).three).toBe(p.optimal);expect(stars(levelKey(p.level),p.path.length)).toBe(3);}
});
it('star boundaries are shared by both field sizes',()=>{for(let i=0;i<levels.length;i++){const k=levelKey(i),t=targets(k);expect(stars(k,t.three)).toBe(3);expect(stars(k,t.three+1)).toBe(2);expect(stars(k,t.two)).toBe(2);expect(stars(k,t.two+1)).toBe(1);}});
it('a slower replay, undo and restart cannot degrade the best result or mutate its history',()=>{
 let s=fresh();for(const m of levels[0].witness)s=moved(s,m);const best=structuredClone(s.best);s=restarted(s);for(const m of levels[0].witness.slice(0,2))s=moved(s,m);
 const completed=attempt(s).board.findIndex(t=>t.length===4&&t.every(c=>c===t[0])),empty=attempt(s).board.findIndex(t=>!t.length);s=moved(s,moveFor(attempt(s).board,completed,empty)!);s=moved(s,moveFor(attempt(s).board,empty,completed)!);s=moved(s,levels[0].witness.at(-1)!);expect(attempt(s).history).toHaveLength(5);expect(stars(levelKey(0),5)).toBe(2);expect(s.best).toEqual(best);s=undone(s);s=restarted(s);expect(s.best).toEqual(best);
});
it('legacy retained wins migrate honestly, completed markers alone do not create a fake record',()=>{
 let s=fresh();for(const m of levels[0].witness)s=moved(s,m);delete s.best;expect(migrateBest(s).best?.[levelKey(0)].history).toHaveLength(3);s=restarted(s);delete s.best;expect(migrateBest(s).best).toEqual({});expect(s.completed).toContain(levels[0].id);
});
it('invalid or fabricated best paths are rejected',()=>{const s=fresh();s.best={[levelKey(0)]:{history:[],extra:false}};expect(validSave(s)).toBe(false);});
it('rewarding a different eligible level preserves the current attempt and is idempotent; tutorials have no offer',()=>{
 const s=moved(fresh(),levels[0].witness[0]);expect(displaySlots(s)).toBe(4);expect(()=>grantExtra(s,levelKey(0))).toThrow();const n=grantExtra(s,levelKey(2));expect(n.current).toBe(0);expect(attempt(n)).toEqual(attempt(s));expect(attempt({...n,current:2}).extra).toBe(true);expect(validSave(n)).toBe(true);expect(grantExtra(n,levelKey(2))).toEqual(n);expect(displaySlots({...s,current:2})).toBe(6);expect(displaySlots({...n,current:2})).toBe(6);
});
