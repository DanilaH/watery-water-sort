import {test,expect} from 'vitest';
import {levels,levelGoals,goalFor,fresh,moved,undone,restarted,expanded,attempt,validSave,levelKey} from '../src/core/session';
import {apply,reverse,moves,moveFor,validBoard,validGoal,won,sealedTube,capacityAt,goalList,type VesselRules} from '../src/core/rules';
import {solve} from '../src/core/solver';
import {layout,goalLayout,miniLayout} from '../src/game/geometry';
import {stars} from '../src/core/ratings';
import proof from '../docs/audits/mini-34/optimal.json';

test('mini accepts only two units, clips contiguous groups, stays pourable and never seals',()=>{
 const spec:VesselRules={goals:[],mini:0},b=[[],[0,0,0,0],[1,1,1,1],[]];
 expect(validBoard(b,spec)).toBe(true);expect(capacityAt(spec,0)).toBe(2);
 const m=moveFor(b,1,0,spec)!;expect(m.amount).toBe(2);const n=apply(b,m,spec);expect(n[0]).toEqual([0,0]);expect(sealedTube(n,0,spec)).toBe(false);expect(won(n,spec)).toBe(false);
 expect(moveFor(n,1,0,spec)).toBeNull();expect(moveFor(n,0,1,spec)?.amount).toBe(2);expect(reverse(n,m,spec)).toEqual(b);
 const partial=[[0,0],[0,0,0],[1,1,1,1],[]];expect(moveFor(partial,0,1,spec)?.amount).toBe(1);
 expect(validBoard([[0,0,0],[0],[1,1,1,1],[]],spec)).toBe(false);
 for(const mini of [-1,99,.5,undefined])expect(validGoal({goals:[],mini}as VesselRules,4)).toBe(false);
 expect(validGoal({goals:[{index:0,color:0,capacity:8}],mini:0},4)).toBe(false);
});

test('all twelve new exact paths save, replay and Undo; every win leaves the mini empty',()=>{
 for(const p of proof.filter(p=>p.level>=22)){
  let s={...fresh(),current:p.level};if(p.extra)s=expanded(s);
  for(const m of p.path){const before=attempt(s).board;s=moved(s,m);expect(reverse(attempt(s).board,m,goalFor(s))).toEqual(before);expect(validSave(JSON.parse(JSON.stringify(s)))).toBe(true);}
  expect(won(attempt(s).board,goalFor(s))).toBe(true);expect(attempt(s).board[levels[p.level].mini!]).toEqual([]);expect(stars(levelKey(p.level),p.path.length)).toBe(3);expect(p.independentNoShorterPath).toBe(true);
  const best=structuredClone(s.best);for(const _ of p.path)s=undone(s);
  expect(attempt(s).board).toEqual([...levels[p.level].initial,...(p.extra?[[]]:[])]);expect(validSave(s)).toBe(true);expect(s.best).toEqual(best);expect(validSave(restarted(s))).toBe(true);
 }
});

test('mini role remains distinct from ordinary tubes, including permuted slots and real dead ends',()=>{
 const dead=[[],[0,1,0,1],[1,2,1,2],[2,0,2,0]];expect(solve(dead,200000,2000,{goals:[],mini:0}).status).toBe('UNSOLVABLE');expect(solve(dead,200000,2000).status).toBe('FOUND');
 for(const l of levels.slice(22)){
  const g=levelGoals(l),b=apply(l.initial,l.witness[0],g),r=solve(b,200000,2000,g);expect(r.status).toBe('FOUND');if(r.status==='FOUND')expect(won(r.path.reduce((b,m)=>apply(b,m,g),b),g)).toBe(true);
  const order=b.map((_,i)=>b.length-1-i),bs=order.map(i=>b[i]),spec={goals:goalList(g).map(g=>({...g,index:order.indexOf(g.index)})),mini:order.indexOf(l.mini!)};
  const permuted=solve(bs,200000,2000,spec);expect(permuted.status).toBe('FOUND');if(permuted.status==='FOUND')expect(won(permuted.path.reduce((b,m)=>apply(b,m,spec),bs),spec)).toBe(true);
 }
});

test('random mini transfers conserve units and reverse, including a granted ordinary tube',()=>{
 for(const l of levels.slice(22)){let b=[...l.initial,[]],seed=340;const initial=b.flat().sort().join(),g=levelGoals(l);
  for(let i=0;i<300;i++){const options=moves(b,g);if(!options.length||won(b,g)){b=[...l.initial,[]];continue;}seed=(Math.imul(seed,1664525)+1013904223)>>>0;const m=options[seed%options.length],n=apply(b,m,g);expect(validBoard(n,g)).toBe(true);expect(n.flat().sort().join()).toBe(initial);expect(reverse(n,m,g)).toEqual(b);b=n;}
 }
});

test('short glass keeps a full exclusive hit cell and aligns its bottom with the original row',()=>{
 for(const [w,h]of [[288,247],[358,538],[452,176],[736,762]])for(const l of levels.slice(22))for(const extra of [0,1]){
  const n=l.initial.length+extra,goals=goalList(levelGoals(l)),base=goals.length?goalLayout(w,h,n,goals.map(g=>g.index)):layout(w,h,n),ps=miniLayout(base,l.mini),small=ps[l.mini!];
  expect(small.h).toBeLessThan(base[l.mini!].h);expect(small.y+small.h).toBeCloseTo(base[l.mini!].y+base[l.mini!].h);expect(small.hitY).toBeCloseTo(base[l.mini!].y+base[l.mini!].h/2);
  for(const r of ps){expect(r.hitW).toBeGreaterThanOrEqual(48);expect(r.hitH).toBeGreaterThanOrEqual(48);expect(r.y+r.h).toBeLessThanOrEqual(h);}
  for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){const a=ps[i],b=ps[j];expect(Math.abs(a.x-b.x)>=(a.hitW+b.hitW)/2||Math.abs((a.hitY??a.y+a.h/2)-(b.hitY??b.y+b.h/2))>=(a.hitH+b.hitH)/2).toBe(true);}
 }
});
