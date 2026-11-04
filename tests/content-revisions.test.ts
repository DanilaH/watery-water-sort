import {test,expect} from 'vitest';
import legacy from '../src/core/levels-v1.json';
import oldProof from '../docs/audits/campaign-39/optimal.json';
import proof from '../docs/audits/campaign-54/optimal.json';
import {levels,allLevels,levelByKey,levelFor,activeKey,levelKey,fresh,attempt,replay,moved,undone,seededRestart,startLatest,grantExtra,validSave,knowledgeFor,goalFor,type Level} from '../src/core/session';
import {settleEconomy} from '../src/core/economy';import {totalStars,earnedStars} from '../src/core/progress';
import {SaveStore} from '../src/platform/storage';import {solveHint} from '../src/core/hintSolver';import {won} from '../src/core/rules';
const changed=levels.slice(0,60).map((l,i)=>l.version>1?i:-1).filter(i=>i>=0);
test('the hardcore campaign adds forty stages; all original content identities remain replayable',()=>{
 expect(levels).toHaveLength(100);expect(allLevels).toHaveLength(162);
 levels.slice(0,60).forEach((l,i)=>{expect(levelByKey(`${l.id}@1`)).toEqual(legacy[i]);if(l.version===1)expect(l).toEqual(legacy[i]);else expect(l.id).toBe(legacy[i].id);});
});
test('every historical path still loads, resumes, restarts and earns its original stars, including hidden memory and buffers',()=>{
 for(const p of oldProof){const l=legacy[p.level]as Level,key=`${l.id}@1`;let s={...fresh(),current:p.level};s.attempts[key]=replay(l,p.path.slice(0,1),!!p.extra);
  const before=structuredClone(s.attempts[key]);let raw=JSON.stringify(s);const store=new SaveStore({getItem:()=>raw,setItem:(_,v)=>{raw=v;}});s=store.load().state;
  expect(activeKey(s)).toBe(key);expect(attempt(s)).toEqual(before);expect(levelFor(s)).toEqual(l);
  const hint=solveHint(attempt(s).board,goalFor(s),activeKey(s),!!p.extra);expect(hint.status).toBe('FOUND');
  for(const m of p.path.slice(1))s=moved(s,m);expect(won(attempt(s).board,goalFor(s))).toBe(true);expect(validSave(s)).toBe(true);expect(earnedStars(s,p.level)).toBe(3);
  const balance=settleEconomy(s).wallet!.coins;s=seededRestart(s);expect(activeKey(s)).toBe(key);expect(attempt(s).extra).toBe(!!p.extra);expect(settleEconomy(s).wallet!.coins).toBe(balance);
 }
});
test('explicit selection starts revised content but preserves old records, archived attempts, knowledge and paid star high-water mark',()=>{
 for(const i of changed){const l=legacy[i]as Level,oldKey=`${l.id}@1`,p=oldProof.find(p=>p.level===i&&!p.extra)!;let s={...fresh(),current:i};s.attempts[oldKey]=replay(l,[],false);
  for(const m of p.path)s=moved(s,m);s=settleEconomy(s);const oldAttempt=structuredClone(s.attempts[oldKey]),oldBest=structuredClone(s.best![oldKey]),wallet=structuredClone(s.wallet);
  s=startLatest(s);expect(activeKey(s)).toBe(levelKey(i));expect(s.attempts[oldKey]).toEqual(oldAttempt);expect(s.best![oldKey]).toEqual(oldBest);expect(s.wallet).toEqual(wallet);expect(earnedStars(s,i)).toBe(3);
  for(const m of proof.find(p=>p.level===i&&!p.extra)!.path)s=moved(s,m);
  expect(validSave(s)).toBe(true);expect(settleEconomy(s).wallet).toEqual(wallet);expect(totalStars(s)).toBe(3);expect(s.best![oldKey]).toEqual(oldBest);
 }
});
test('late historical reward is isolated from revised attempt and survives reload without duplicate granting',()=>{
 for(const i of changed.filter(i=>(legacy[i]as Level).colors>2)){
  const s=seededRestart({...fresh(),current:i}),before=structuredClone(attempt(s)),key=`${levels[i].id}@1`,n=grantExtra(s,key);
  expect(activeKey(n)).toBe(levelKey(i));expect(attempt(n)).toEqual(before);expect(n.attempts[key].extra).toBe(true);expect(validSave(n)).toBe(true);expect(grantExtra(n,key)).toEqual(n);
  let raw=JSON.stringify(n);const store=new SaveStore({getItem:()=>raw,setItem:(_,v)=>{raw=v;}});expect(activeKey(store.load().state)).toBe(levelKey(i));
 }
});
test('failed selection write leaves persisted historical attempt intact and corrupt revision keys are rejected',()=>{
 const i=2,key=`${levels[i].id}@1`,s={...fresh(),current:i};s.attempts[key]=replay(legacy[i]as Level,[],false);const raw=JSON.stringify(s);
 const store=new SaveStore({getItem:()=>raw,setItem:()=>{throw Error('Full');}});expect(()=>store.write(startLatest(s))).toThrow('Full');expect(activeKey(store.load().state)).toBe(key);
 const bad=structuredClone(s);bad.attempts[`${levels[i].id}@999`]=bad.attempts[key];expect(validSave(bad)).toBe(false);
});
