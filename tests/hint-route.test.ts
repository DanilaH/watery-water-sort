import {test,expect} from 'vitest';
import {HintRoute} from '../src/core/hintRoute';
import {levels,fresh,moved,attempt,goalFor,expanded,levelGoals} from '../src/core/session';
import {solve} from '../src/core/solver';import {won,moves} from '../src/core/rules';
test('repeated advice follows one verified winning route across all 80 field configurations',()=>{
 for(let i=0;i<levels.length;i++)for(const extra of [false,true]){let s={...fresh(),current:i};if(extra)s=expanded(s);const route=new HintRoute(),r=solve(attempt(s).board,200000,750,goalFor(s));expect(r.status).toBe('FOUND');if(r.status!=='FOUND')continue;
  expect(route.set(attempt(s).board,goalFor(s),r.path)).toBe(true);let n=0;while(!won(attempt(s).board,goalFor(s))){const before=attempt(s).board,g=goalFor(s),m=route.get(before,g)!;expect(m).toBeDefined();route.accepted(before,m,g);s=moved(s,m);expect(++n).toBeLessThanOrEqual(r.path.length);}expect(route.get(attempt(s).board,goalFor(s))).toBeUndefined();expect(n).toBe(r.path.length);
 }
});
test('deviation, changed entitlement and changed thaw state never reuse a stale route',()=>{
 const l=levels[4],g=levelGoals(l),r=solve(l.initial,200000,750,g);if(r.status!=='FOUND')throw Error('witness');const route=new HintRoute();route.set(l.initial,g,r.path);expect(route.get([...l.initial,[]],g)).toBeUndefined();const other=moves(l.initial,g).find(m=>JSON.stringify(m)!==JSON.stringify(r.path[0]))!;route.accepted(l.initial,other,g);expect(route.get(l.initial,g)).toBeUndefined();
 const ice=levels[29],ir=solve(ice.initial,200000,750,levelGoals(ice));if(ir.status!=='FOUND')throw Error('ice');route.set(ice.initial,levelGoals(ice),ir.path);expect(route.get(ice.initial,levelGoals(ice,true))).toBeUndefined();
});
test('invalid routes cannot replace a known-good route; input path is copied',()=>{
 const route=new HintRoute(),l=levels[0],path=structuredClone(l.witness);expect(route.set(l.initial,undefined,path)).toBe(true);path[0].amount=999;expect(route.get(l.initial)?.amount).toBe(2);expect(route.set(l.initial,undefined,[{from:0,to:1,color:0,amount:99}])).toBe(false);expect(route.get(l.initial)?.amount).toBe(2);route.clear();expect(route.get(l.initial)).toBeUndefined();
});
