import {test,expect} from 'vitest';
import {apply,reverse,moveFor,moves,won,validBoard,sealedTube,type Board} from '../src/core/rules';
import {fresh,levels,moved,undone,restarted,attempt,validSave,levelKey,goalFor,expanded,migrateBest} from '../src/core/session';
import {solve} from '../src/core/solver';import {targets} from '../src/core/ratings';import {goalLayout} from '../src/game/geometry';
import proof from '../docs/audits/giant-17/optimal.json';
const level=levels[12],goal=level.goal!;
test('goal is colour locked, receive only, eight units; four-unit goal-colour vessels are unfinished',()=>{
 expect(validBoard(level.initial,goal)).toBe(true);expect(validBoard(level.initial)).toBe(false);
 expect(moveFor(level.initial,1,0,goal)).toBeNull();
 const poured=apply(level.initial,moveFor(level.initial,3,0,goal)!,goal);
 expect(poured[0]).toHaveLength(4);expect(moveFor(poured,0,4,goal)).toBeNull();expect(sealedTube(poured,0,goal)).toBe(false);expect(won(poured,goal)).toBe(false);
 const misleading:Board=[[],[0,0,0,0],[0,0,0,0],[1,1,1,1],[]];expect(validBoard(misleading,goal)).toBe(true);expect(won(misleading,goal)).toBe(false);expect(sealedTube(misleading,1,goal)).toBe(false);
 const bad=structuredClone(level.initial);bad[0]=[1];bad[1].pop();expect(validBoard(bad,goal)).toBe(false);
 expect(validBoard(level.initial,{...goal,index:99})).toBe(false);
});
test('all eight new exact paths replay through durable state; best records survive Undo and restart',()=>{
 for(const p of proof.filter(p=>p.level>=12)){
  let s={...fresh(),current:p.level};if(p.extra)s=expanded(s);
  for(const m of p.path){const before=attempt(s).board;s=moved(s,m);expect(reverse(attempt(s).board,m,goalFor(s))).toEqual(before);expect(validSave(s)).toBe(true);}
  expect(won(attempt(s).board,goalFor(s))).toBe(true);expect(targets(levelKey(p.level)).three).toBe(p.optimal);expect(p.independentNoShorterPath).toBe(true);
  const best=structuredClone(s.best);expect(migrateBest(s).best).toEqual(best);s=undone(s);expect(won(attempt(s).board,goalFor(s))).toBe(false);expect(s.best).toEqual(best);expect(validSave(s)).toBe(true);
  s=restarted(s);expect(attempt(s).board[0]).toEqual([]);expect(s.best).toEqual(best);expect(validSave(s)).toBe(true);
 }
});
test('solver keeps goal identity separate while ordinary slots may permute',()=>{
 for(const l of levels.filter(l=>l.goal)){
  const result=solve(l.initial,200000,2000,l.goal);expect(result.status).toBe('FOUND');if(result.status==='FOUND')expect(won(result.path.reduce((b,m)=>apply(b,m,l.goal),l.initial),l.goal)).toBe(true);
  const shifted=[l.initial[1],l.initial[0],...l.initial.slice(2)],movedGoal={...l.goal!,index:1};const shiftedResult=solve(shifted,200000,2000,movedGoal);expect(shiftedResult.status).toBe('FOUND');if(shiftedResult.status==='FOUND')expect(won(shiftedResult.path.reduce((b,m)=>apply(b,m,movedGoal),shifted),movedGoal)).toBe(true);
 }
});
test('exploratory goal moves conserve units and every accepted transfer reverses exactly',()=>{
 let b=levels[15].initial,seed=43;const g=levels[15].goal!,counts=b.flat().sort().join();
 for(let i=0;i<500;i++){const options=moves(b,g);if(!options.length||won(b,g)){b=levels[15].initial;continue;}seed=(Math.imul(seed,1664525)+1013904223)>>>0;const m=options[seed%options.length],next=apply(b,m,g);expect(validBoard(next,g)).toBe(true);expect(next.flat().sort().join()).toBe(counts);expect(reverse(next,m,g)).toEqual(b);b=next;}
});
test('goal matches the top and bottom of the bank and keeps separated 48px targets',()=>{
 for(const [w,h]of [[288,247],[358,542],[384,220],[420,176]])for(const count of [5,6,7,8]){
  const ps=goalLayout(w,h,count,0);expect(ps[0].y).toBeCloseTo(Math.min(...ps.slice(1).map(p=>p.y)),6);expect(ps[0].y+ps[0].h).toBeCloseTo(Math.max(...ps.slice(1).map(p=>p.y+p.h)),6);
  for(const p of ps){expect(p.hitW).toBeGreaterThanOrEqual(48);expect(p.hitH).toBeGreaterThanOrEqual(48);expect(p.x-p.hitW/2).toBeGreaterThanOrEqual(0);expect(p.x+p.hitW/2).toBeLessThanOrEqual(w);}
  for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){const a=ps[i],b=ps[j];expect(Math.abs(a.x-b.x)>=(a.hitW+b.hitW)/2||Math.abs(a.y+a.h/2-b.y-b.h/2)>=(a.hitH+b.hitH)/2).toBe(true);}
 }
});
