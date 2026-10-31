import {test,expect} from 'vitest';
import {levels,levelGoals,goalFor,fresh,moved,undone,restarted,expanded,attempt,validSave,levelKey,replay} from '../src/core/session';
import {moves,moveFor,validBoard,validGoal,won,sealedTube,transition,iceOpen,isFrozen,type VesselRules} from '../src/core/rules';
import {solve} from '../src/core/solver';import {stars} from '../src/core/ratings';
import proof from '../docs/audits/ice-35/optimal.json';

test('ice blocks both directions; earning one complete colour opens it once',()=>{
 const l=levels[28],g=levelGoals(l)!;expect(validBoard(l.initial,g)).toBe(true);expect(moveFor(l.initial,'0' as any,3,g)).toBeNull();
 for(let i=1;i<l.initial.length;i++){expect(moveFor(l.initial,0,i,g)).toBeNull();expect(moveFor(l.initial,i,0,g)).toBeNull();}
 let s={...fresh(),current:28};for(const m of l.witness.slice(0,2))s=moved(s,m);expect(iceOpen(goalFor(s))).toBe(true);expect(attempt(s).thawed).toBe(true);expect(moveFor(attempt(s).board,1,0,goalFor(s))).not.toBeNull();
 // Relocating a complete vessel neither earns a colour nor opens a closed gate.
 const b=[[0,0],[0,0],[1,1,1,1],[],[]],r={goals:[],ice:0,thawed:false};const m=moveFor(b,2,3,r)!;expect(iceOpen(transition(b,m,r).rules)).toBe(false);
 // The mini is not a finished colour even at capacity.
 const spec={goals:[],mini:0,ice:1,thawed:false};expect(iceOpen(transition([[],[0,0],[0,0],[1,1,1,1],[]],{from:3,to:0,color:1,amount:2},spec).rules)).toBe(false);
 for(const bad of [{goals:[],ice:-1},{goals:[],ice:99},{goals:[],mini:0,ice:0},{goals:[{index:0,color:0,capacity:8}],ice:0},{goals:[],ice:0,thawed:1}])expect(validGoal(bad as VesselRules,4)).toBe(false);
});

test('thaw persists after using a completed bottle, but Undo across its earning move refreezes it',()=>{
 const l=levels[29],p=proof.find(p=>p.level===29&&!p.extra)!;let s={...fresh(),current:29};
 for(const m of p.path.slice(0,p.thawMove!))s=moved(s,m);expect(iceOpen(goalFor(s))).toBe(true);expect(validSave(JSON.parse(JSON.stringify(s)))).toBe(true);
 const before=structuredClone(s),colourTube=attempt(s).board.findIndex((_,i)=>sealedTube(attempt(s).board,i,goalFor(s))),empty=attempt(s).board.findIndex((t,i)=>!t.length&&i!==l.ice);
 if(empty>=0){s=moved(s,moveFor(attempt(s).board,colourTube,empty,goalFor(s))!);expect(iceOpen(goalFor(s))).toBe(true);s=undone(s);expect(attempt(s)).toEqual(attempt(before));}
 s=undone(s);expect(isFrozen(goalFor(s),l.ice!)).toBe(true);expect(validSave(s)).toBe(true);expect(attempt(restarted(before)).thawed).not.toBe(true);
 const forged={...fresh(),current:29};forged.attempts[levelKey(29)]={...attempt(forged),thawed:true};expect(validSave(forged)).toBe(false);
});

test('all twelve exact ice paths replay through durable state and preserve best results after Undo',()=>{
 for(const p of proof.filter(p=>p.level>=28)){
  let s={...fresh(),current:p.level};if(p.extra)s=expanded(s);
  for(let i=0;i<p.path.length;i++){s=moved(s,p.path[i]);expect(validSave(s)).toBe(true);expect(iceOpen(goalFor(s))).toBe(i+1>=p.thawMove!);}
  expect(won(attempt(s).board,goalFor(s))).toBe(true);expect(stars(levelKey(p.level),p.path.length)).toBe(3);expect(p.independentNoShorterPath).toBe(true);
  const best=structuredClone(s.best);for(const _ of p.path)s=undone(s);expect(attempt(s).board).toEqual([...levels[p.level].initial,...(p.extra?[[]]:[])]);expect(attempt(s).thawed).toBe(false);expect(validSave(s)).toBe(true);expect(s.best).toEqual(best);
 }
});

test('worker search keeps earned access and fixed ice identity across arbitrary slot positions',()=>{
 for(const l of levels.slice(28)){
  const spec=levelGoals(l),result=solve(l.initial,200000,2000,spec);expect(result.status).toBe('FOUND');
  if(result.status==='FOUND'){let state={board:l.initial,rules:spec};for(const m of result.path)state=transition(state.board,m,state.rules);expect(won(state.board,state.rules)).toBe(true);}
  const order=l.initial.map((_,i)=>l.initial.length-1-i),r=spec as VesselRules,shifted={goals:r.goals.map(g=>({...g,index:order.indexOf(g.index)})),...(r.mini!==undefined?{mini:order.indexOf(r.mini)}:{}),ice:order.indexOf(r.ice!),thawed:false};
  const b=order.map(i=>l.initial[i]),found=solve(b,200000,2000,shifted);expect(found.status).toBe('FOUND');if(found.status==='FOUND'){let s:{board:number[][];rules:typeof spec}={board:b,rules:shifted};for(const m of found.path)s=transition(s.board,m,s.rules);expect(won(s.board,s.rules)).toBe(true);}
 }
});

test('rewarded slot cannot win around inaccessible liquid; history replays with its original entitlement',()=>{
 for(const l of levels.slice(28)){let s=expanded({...fresh(),current:levels.indexOf(l)});for(const m of l.witness)s=moved(s,m);expect(won(attempt(s).board,goalFor(s))).toBe(true);expect(attempt(s).thawed).toBe(true);const r=restarted(s);expect(attempt(r).extra).toBe(true);expect(attempt(r).thawed).not.toBe(true);expect(validSave(r)).toBe(true);}
});
