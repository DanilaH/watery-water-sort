import {test,expect} from 'vitest';
import {levels,levelGoals,goalFor,fresh,moved,undone,restarted,expanded,attempt,validSave,levelKey} from '../src/core/session';
import {apply,reverse,moves,moveFor,validBoard,validGoal,won,sealedTube,type Goal} from '../src/core/rules';
import {solve} from '../src/core/solver';
import {goalLayout} from '../src/game/geometry';
import {stars} from '../src/core/ratings';
import proof from '../docs/audits/dual-goals-33/optimal.json';

test('two receivers have distinct colours and identities; each must fill in its own slot',()=>{
 const l=levels[16],g=l.goals!;expect(validBoard(l.initial,g)).toBe(true);
 for(const bad of [[],[g[0],g[0]],[g[0],{...g[1],color:g[0].color}],[...g,g[0]],[g[0],{...g[1],index:99}]])expect(validGoal(bad as Goal[],l.initial.length)).toBe(false);
 const solved=l.witness.reduce((b,m)=>apply(b,m,g),l.initial);expect(won(solved,g)).toBe(true);
 expect(won([solved[1],solved[0],...solved.slice(2)],g)).toBe(false);
 for(let i=0;i<2;i++){expect(moveFor(solved,i,6,g)).toBeNull();expect(sealedTube(solved,i,g)).toBe(true);}
 const four=apply(l.initial,moveFor(l.initial,4,0,g)!,g);expect(won(four,g)).toBe(false);expect(sealedTube(four,0,g)).toBe(false);expect(moveFor(four,5,0,g)).toBeNull();
});

test('all twelve new exact solutions survive save/reload, reward entitlement, full Undo and restart',()=>{
 for(const p of proof.filter(p=>p.level>=16)){
  let s={...fresh(),current:p.level};if(p.extra)s=expanded(s);
  for(const m of p.path){const b=attempt(s).board;s=moved(s,m);expect(reverse(attempt(s).board,m,goalFor(s))).toEqual(b);expect(validSave(JSON.parse(JSON.stringify(s)))).toBe(true);}
  expect(won(attempt(s).board,goalFor(s))).toBe(true);expect(stars(levelKey(p.level),p.path.length)).toBe(3);expect(p.independentNoShorterPath).toBe(true);
  const best=structuredClone(s.best);for(const _ of p.path)s=undone(s);
  expect(attempt(s).board).toEqual([...levels[p.level].initial,...(p.extra?[[]]:[])]);expect(validSave(s)).toBe(true);expect(s.best).toEqual(best);
  expect(validSave(restarted(s))).toBe(true);
 }
});

test('worker solver handles partial goals and arbitrary goal positions without merging their roles',()=>{
 for(const l of levels.slice(16,22)){
  const g=l.goals!,b=apply(l.initial,l.witness[0],g),r=solve(b,200000,2000,g);expect(r.status).toBe('FOUND');if(r.status==='FOUND')expect(won(r.path.reduce((b,m)=>apply(b,m,g),b),g)).toBe(true);
  const permutation=[2,1,0,...l.initial.slice(3).map((_,i)=>i+3)],shifted=permutation.map(i=>b[i]),gs=g.map(x=>({...x,index:permutation.indexOf(x.index)}));
  const other=solve(shifted,200000,2000,gs);expect(other.status).toBe('FOUND');if(other.status==='FOUND')expect(won(other.path.reduce((b,m)=>apply(b,m,gs),shifted),gs)).toBe(true);
 }
});

test('two-goal exploratory transfers conserve every colour and reverse exactly',()=>{
 for(const l of levels.slice(16,22)){let b=l.initial,seed=33;const initial=b.flat().sort().join(),g=levelGoals(l);
  for(let i=0;i<300;i++){const options=moves(b,g);if(!options.length||won(b,g)){b=l.initial;continue;}seed=(Math.imul(seed,1664525)+1013904223)>>>0;const m=options[seed%options.length],n=apply(b,m,g);expect(validBoard(n,g)).toBe(true);expect(n.flat().sort().join()).toBe(initial);expect(reverse(n,m,g)).toEqual(b);b=n;}
 }
});

test('both receivers align with all rows, retain exclusive 48px targets including the reward slot',()=>{
 for(const [w,h]of [[288,247],[288,263],[358,538],[452,176],[736,762]])for(const count of [7,8,9,10]){
  const ps=goalLayout(w,h,count,[0,1]),bank=ps.slice(2),top=Math.min(...bank.map(r=>r.y)),bottom=Math.max(...bank.map(r=>r.y+r.h));
  for(const r of ps){expect(r.hitW).toBeGreaterThanOrEqual(48);expect(r.hitH).toBeGreaterThanOrEqual(48);expect(r.x-r.hitW/2).toBeGreaterThanOrEqual(0);expect(r.x+r.hitW/2).toBeLessThanOrEqual(w);expect(r.y).toBeGreaterThanOrEqual(0);expect(r.y+r.h).toBeLessThanOrEqual(h);}
  for(const r of ps.slice(0,2)){expect(r.y).toBeCloseTo(top);expect(r.y+r.h).toBeCloseTo(bottom);}
  for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){const a=ps[i],b=ps[j];expect(Math.abs(a.x-b.x)>=(a.hitW+b.hitW)/2||Math.abs(a.y+a.h/2-b.y-b.h/2)>=(a.hitH+b.hitH)/2).toBe(true);}
 }
});
