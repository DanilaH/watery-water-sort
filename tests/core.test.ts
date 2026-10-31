import { describe, it, expect } from 'vitest';
import { apply, moveFor, moves, reverse, validBoard, won, type Board, capacityAt, transition } from '../src/core/rules';
import { solve } from '../src/core/solver';
import { levels, fresh, moved, undone, restarted, expanded, validSave, attempt, levelKey, levelGoals } from '../src/core/session';
import { SaveStore } from '../src/platform/storage';
import { area, clip, surface, layout, goalLayout, miniLayout, bounds, planPour, pourPose, vesselPolygon, LIQUID_FILL, pourTransfer, pourTiming, pourFrame } from '../src/game/geometry';
describe('rules',()=>{
 it('pours only the contiguous group or available space',()=>{
  expect(moveFor([[0,0,1,1],[1,1,1],[],[]],0,1)).toEqual({from:0,to:1,color:1,amount:1});
  expect(moveFor([[0,0,1,1],[],[],[]],0,1)?.amount).toBe(2);
  expect(moveFor([[1],[0],[],[]],0,1)).toBeNull();
  expect(moveFor([[1],[],[],[]],0,0)).toBeNull();
 });
 it('partial uniform tubes are not a victory',()=>{expect(won([[0,0],[0,0],[1,1,1,1],[]])).toBe(false);expect(won([[0,0,0,0],[1,1,1,1],[],[]])).toBe(true);});
 it('preserves every color and reverses 2000 deterministic exploratory moves',()=>{
  let board:Board=levels[7].initial;const initial=JSON.stringify(board.flat().sort());let seed=77;
  for(let i=0;i<2000;i++){const ms=moves(board);if(!ms.length){board=levels[7].initial;continue;}seed=(Math.imul(seed,1664525)+1013904223)>>>0;const m=ms[seed%ms.length],next=apply(board,m);expect(validBoard(next)).toBe(true);expect(JSON.stringify(next.flat().sort())).toBe(initial);expect(reverse(next,m)).toEqual(board);board=next;}
 });
 it('rejects stale move payloads',()=>expect(()=>apply(levels[0].initial,{from:0,to:2,color:1,amount:1})).toThrow());
});
describe('bank and solver',()=>{
 it('independently replays all campaign witnesses with their actual capacities and goals',()=>{
  expect(levels).toHaveLength(40);
  for(const l of levels){const gs=l.goals??(l.goal?[l.goal]:[]);let opened=l.ice===undefined,b:Board=l.initial.map(t=>[...t]);for(const m of l.witness){
   expect(opened||m.from!==l.ice&&m.to!==l.ice).toBe(true);const source=b[m.from],target=b[m.to],sourceSealed=m.from!==l.mini&&source.length===4&&source.every(c=>c===source[0])&&!gs.some(g=>g.color===source[0]),capacity=m.to===l.mini?2:gs.some(g=>g.index===m.to)?8:4;
   expect(gs.some(g=>g.index===m.from)).toBe(false);expect(source.length).toBeGreaterThan(0);expect(target.length+m.amount).toBeLessThanOrEqual(capacity);
   const color=source.at(-1)!;if(gs.some(g=>g.index===m.to))expect(color).toBe(gs.find(g=>g.index===m.to)!.color);
   expect(target.length===0||target.at(-1)===color).toBe(true);let group=0;for(let j=source.length-1;j>=0&&source[j]===color;j--)group++;
   const q=Math.min(group,capacity-target.length);expect(q).toBe(m.amount);target.push(...source.splice(-q));if(!opened&&!sourceSealed&&m.to!==l.mini&&target.length===capacity&&target.every(c=>c===target[0])&&(gs.some(g=>g.index===m.to)||!gs.some(g=>g.color===target[0])))opened=true;
  }expect(opened).toBe(true);expect(b.every((t,i)=>i===l.mini?!t.length:gs.some(g=>g.index===i)?t.length===8&&t.every(c=>c===gs.find(g=>g.index===i)!.color):!t.length||t.length===4&&t.every(c=>c===t[0])&&!gs.some(g=>g.color===t[0]))).toBe(true);}
 });
 it('solves current positions and distinguishes unknown from proven dead ends',()=>{
  const b=apply(levels[3].initial,levels[3].witness[0]);const r=solve(b,200000,2000);expect(r.status).toBe('FOUND');if(r.status==='FOUND'){let next=b;for(const m of r.path)next=apply(next,m);expect(won(next)).toBe(true);}
  expect(solve(levels[0].initial,0).status).toBe('UNKNOWN');
  expect(solve([[0,1,0,1],[1,0,1,0],[2,3,2,3],[3,2,3,2]]).status).toBe('UNSOLVABLE');
 });
});
describe('durable state',()=>{
 it('undo and restart retain extra tube entitlement across old history',()=>{
  let s=moved(fresh(),levels[0].witness[0]);const a=attempt(s);a.extra=true;a.board.push([]);s.attempts[levelKey(0)]=a;
  expect(validSave(s)).toBe(true);s=undone(s);expect(attempt(s).board).toHaveLength(5);expect(attempt(s).extra).toBe(true);expect(validSave(restarted(s))).toBe(true);
 });
 it('rejects tampered history and impossible saved boards',()=>{const s=moved(fresh(),levels[0].witness[0]);attempt(s).board[0].push(7);expect(validSave(s)).toBe(false);});
 it('restores a complete previous snapshot and does not overwrite corruption silently',()=>{
  const data=new Map<string,string>();const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};const repo=new SaveStore(storage);repo.write(fresh());repo.write(moved(fresh(),levels[0].witness[0]));data.set('water-sort-v1','broken');expect(repo.load()).toMatchObject({recovered:true,corrupt:false,state:fresh()});data.set('water-sort-v1-backup','broken');expect(repo.load().corrupt).toBe(true);
 });
 it('failed writes never accept a new state',()=>{const repo=new SaveStore({getItem:()=>null,setItem:()=>{throw Error('quota');}});expect(()=>repo.write(fresh())).toThrow('quota');});
});
describe('liquid geometry',()=>{
 it('conserves rendered volume when tilted',()=>{const poly=[{x:0,y:0},{x:40,y:20},{x:0,y:140},{x:-40,y:120}];for(const f of [.1,.25,.5,.87])expect(area(clip(poly,surface(poly,f),true))/area(poly)).toBeCloseTo(f,4);});
 it('fits 11 cells on small portrait and landscape boards without overlapping hit targets',()=>{for(const [w,h] of [[292,300],[526,180]]){const p=layout(w,h,11);for(const r of p){expect(r.y).toBeGreaterThanOrEqual(0);expect(r.y+r.h).toBeLessThanOrEqual(h);expect(Math.max(48,r.w*1.4)).toBeGreaterThanOrEqual(48);}}});
});

describe('polished field geometry',()=>{
 it('gives every cell exclusive targets on the viewport matrix',()=>{
  for(const [w,h]of [[296,294],[366,542],[456,161],[720,730],[1000,486],[296,219]])for(const count of [5,6,7,8,9,10,11]){
   const p=layout(w,h,count);for(const a of p){expect(a.hitW).toBeGreaterThanOrEqual(48);expect(a.hitH).toBeGreaterThanOrEqual(48);}
   for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){const a=p[i],b=p[j];expect(Math.abs(a.x-b.x)>=(a.hitW+b.hitW)/2||Math.abs(a.y+a.h/2-b.y-b.h/2)>=(a.hitH+b.hitH)/2).toBe(true);}
  }
 });
 it('keeps the moving silhouette inside the field on every source/target pair',()=>{
  for(const [w,h]of [[296,294],[366,542],[456,161],[720,730]])for(const count of [5,6,7,8,9,10,11]){
   const p=layout(w,h,count);for(let i=0;i<p.length;i++)for(let j=0;j<p.length;j++){if(i===j)continue;const plan=planPour(p[i],p[j],w,h);for(let n=0;n<=24;n++){const r=pourPose(p[i],p[j],n/24,w,h,-17,plan),b=bounds(r,r.angle);expect(b.left).toBeGreaterThanOrEqual(4.99);expect(b.top).toBeGreaterThanOrEqual(4.99);expect(b.right).toBeLessThanOrEqual(w-4.99);expect(b.bottom).toBeLessThanOrEqual(h-4.99);}}
  }
 });
});

describe('night art upgrade',()=>{
 it('keeps old progress, enters the new theme once, and retains a subsequent theme choice',()=>{
  const legacy=moved(fresh(),levels[0].witness[0]);delete legacy.artVersion;legacy.settings.light=true;
  const data=new Map([['water-sort-v1',JSON.stringify(legacy)]]),store=new SaveStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);}});
  const upgraded=store.load();expect(upgraded.corrupt).toBe(false);expect(upgraded.state.settings.light).toBe(false);expect(upgraded.state.artVersion).toBe(4);expect(attempt(upgraded.state)).toEqual(attempt(legacy));expect(upgraded.state.completed).toEqual(legacy.completed);
  upgraded.state.settings.light=true;store.write(upgraded.state);expect(store.load().state.settings.light).toBe(true);
 });
});


describe('connected pouring',()=>{
 it('keeps the liquid at the outlet throughout legal pours, including the last partial unit',()=>{
  for(const [width,height] of [[288,263],[358,582],[452,176],[736,762]])for(const level of levels){
   let board:Board=level.initial,rules=levelGoals(level);const gs=level.goals??(level.goal?[level.goal]:[]),ps=miniLayout(gs.length?goalLayout(width,height,board.length,gs.map(g=>g.index)):layout(width,height,board.length),level.mini);
   for(const m of level.witness){const before=board[m.from].length,capacity=capacityAt(levelGoals(level),m.from),plan=planPour(ps[m.from],ps[m.to],width,height,before*4/capacity,(before-m.amount)*4/capacity);
    for(const t of [.25,.35,.5,.65,.729]){const r=pourPose(ps[m.from],ps[m.to],t,width,height,0,plan),c=Math.cos(r.angle),s=Math.sin(r.angle);
     const poly=vesselPolygon(r.w,r.h).map(p=>({x:r.x+p.x*c-p.y*s,y:r.y+p.x*s+p.y*c})),units=before-m.amount*pourTransfer(t),lip=r.y+r.tipX*s;
     expect(Math.abs(surface(poly,units/capacity*LIQUID_FILL)-lip)).toBeLessThan(.02);
     const b=bounds(r,r.angle);expect(b.left).toBeGreaterThanOrEqual(4.99);expect(b.right).toBeLessThanOrEqual(width-4.99);expect(b.top).toBeGreaterThanOrEqual(4.99);expect(b.bottom).toBeLessThanOrEqual(height-4.99);
    }const next=transition(board,m,rules);board=next.board;rules=next.rules;
   }
  }
 });
 it('keeps a dense small-phone field readable without a phantom slot',()=>{
  const ps=layout(288,263,10);expect(new Set(ps.map(p=>p.y)).size).toBe(2);expect(ps[0].w).toBeGreaterThanOrEqual(26);expect(ps[0].h).toBeGreaterThanOrEqual(90);
 });
});


describe('unavailable storage',()=>{
 it('handles an inaccessible storage getter without writing a new save',()=>{
  const store=new SaveStore(()=>{throw new DOMException('blocked','SecurityError');});
  expect(store.load()).toMatchObject({unavailable:true,corrupt:false,recovered:false});
 });
 it('does not mistake a failed read and an absent backup for an empty store',()=>{
  const store=new SaveStore({getItem:k=>{if(k==='water-sort-v1')throw Error('blocked');return null;},setItem:()=>{throw Error('must not write');}});
  expect(store.load()).toMatchObject({unavailable:true,corrupt:false});
 });
});

it('does not unlock an older backup when the primary snapshot could not be read',()=>{
 const store=new SaveStore({getItem:k=>{if(k==='water-sort-v1')throw Error('blocked');return JSON.stringify(fresh());},setItem:()=>{throw Error('must not write');}});
 expect(store.load()).toMatchObject({unavailable:true,recovered:false,corrupt:false});
});


describe('additional tube',()=>{
 it('is granted once without changing accepted moves, including across undo and restart',()=>{
  const before=moved(fresh(),levels[0].witness[0]),after=expanded(before);
  expect(attempt(before).extra).toBe(false);expect(attempt(after).board).toEqual([...attempt(before).board,[]]);
  expect(attempt(after).history).toEqual(attempt(before).history);expect(validSave(after)).toBe(true);
  expect(expanded(after)).toBe(after);expect(validSave(undone(after))).toBe(true);expect(validSave(restarted(after))).toBe(true);
  const n=moved(after,{from:0,to:4,color:attempt(after).board[0].at(-1)!,amount:2});
  expect(validSave(n)).toBe(true);expect(attempt(undone(n)).board).toEqual(attempt(after).board);
 });
});


describe('material pouring rhythm',()=>{
 it('gives larger groups more flow time while preserving the lift, transfer and return boundaries',()=>{
  for(const fast of [false,true]){let previous=0;for(let amount=1;amount<=4;amount++){
   const timing=pourTiming(amount,fast);expect(timing.duration).toBeGreaterThan(previous);previous=timing.duration;
   expect(pourFrame(timing.lift,timing).t).toBeCloseTo(.25);expect(pourFrame(timing.lift+timing.flow,timing).t).toBeCloseTo(.73);
   expect(pourFrame(timing.duration+800,timing)).toMatchObject({t:1,remaining:0});
   for(let ms=0;ms<=timing.duration;ms++){const f=pourFrame(ms,timing);expect(pourTransfer(f.t)).toBeGreaterThanOrEqual(0);expect(pourTransfer(f.t)).toBeLessThanOrEqual(1);}
  }}
 });
 it('starts and ends the volume transfer smoothly without reversing it',()=>{
  let prev=0;for(let n=0;n<=1000;n++){const v=pourTransfer(n/1000);expect(v).toBeGreaterThanOrEqual(prev);prev=v;}
  expect(pourTransfer(.25)).toBe(0);expect(pourTransfer(.73)).toBe(1);
  expect(pourTransfer(.251)).toBeLessThan(.00002);expect(1-pourTransfer(.729)).toBeLessThan(.00002);
 });
});
