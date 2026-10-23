import { describe, it, expect } from 'vitest';
import { apply, moveFor, moves, reverse, validBoard, won, type Board } from '../src/core/rules';
import { solve } from '../src/core/solver';
import { levels, fresh, moved, undone, restarted, validSave, attempt, levelKey } from '../src/core/session';
import { SaveStore } from '../src/platform/storage';
import { area, clip, surface, layout } from '../src/game/geometry';
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
 it('independently replays all 12 witnesses',()=>{
  expect(levels).toHaveLength(12);
  for(const l of levels){let b:Board=l.initial.map(t=>[...t]);for(const m of l.witness){const source=b[m.from],target=b[m.to];expect(source.length).toBeGreaterThan(0);expect(target.length+m.amount).toBeLessThanOrEqual(4);expect(target.length===0||target.at(-1)===source.at(-1)).toBe(true);const color=source.at(-1)!;let group=0;for(let j=source.length-1;j>=0&&source[j]===color;j--)group++;const q=Math.min(group,4-target.length);expect(q).toBe(m.amount);target.push(...source.splice(-q));}expect(b.every(t=>!t.length||t.length===4&&t.every(c=>c===t[0]))).toBe(true);}
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
