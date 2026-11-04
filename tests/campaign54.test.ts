import {test,expect} from 'vitest';
import previous from '../src/core/levels-v47.json';
import proof from '../docs/audits/campaign-balance-47/optimal.json';
import {levels,levelByKey,levelFor,activeKey,fresh,replay,attempt,moved,seededRestart,startLatest,validSave,type Level} from '../src/core/session';
import {campaign,continuation,available} from '../src/core/campaign';
import {earnedStars} from '../src/core/progress';
import {settleEconomy} from '../src/core/economy';
import {SaveStore} from '../src/platform/storage';

test('all 0.53 routes still load, finish, and retain their earned stars after replaying the latest revision',()=>{
 for(const p of proof){
  const l=previous[p.level] as Level,key=l.id+'@'+l.version;
  expect(levelByKey(key)).toEqual(l);
  let s={...fresh(),current:p.level};s.attempts[key]=replay(l,p.path.slice(0,1),!!p.extra);
  const old=structuredClone(attempt(s)),raw=JSON.stringify(s);
  s=new SaveStore({getItem:()=>raw,setItem:()=>{throw Error('Read only');}}).load().state;
  expect(attempt(s)).toEqual(old);
  for(const m of p.path.slice(1))s=moved(s,m);
  expect(validSave(s)).toBe(true);expect(earnedStars(s,p.level)).toBe(3);
  s=settleEconomy(s);const coins=s.wallet!.coins;
  s=seededRestart(s);expect(activeKey(s)).toBe(key);expect(attempt(s).extra).toBe(!!p.extra);
  s=startLatest(s);expect(levelFor(s)).toEqual(levels[p.level]);expect(s.best![key].history).toEqual(p.path);expect(settleEconomy(s).wallet!.coins).toBe(coins);
 }
});

test('the old finale unlocks stage 61 without losing its progress',()=>{
 const l=previous[59] as Level,key=l.id+'@'+l.version,path=proof.find(p=>p.level===59&&!p.extra)!.path;
 let s={...fresh(),current:59,completed:campaign.slice(0,60).map(i=>levels[i].id)};
 s.attempts[key]=replay(l,path,false);s.best={[key]:{history:path,extra:false}};
 s=JSON.parse(JSON.stringify(s));expect(validSave(s)).toBe(true);expect(continuation(s)).toBe(60);expect(available(s,60)).toBe(true);expect(available(s,61)).toBe(false);
 const n=startLatest({...s,current:60});expect(n.completed).toEqual(s.completed);expect(n.attempts[key]).toEqual(s.attempts[key]);expect(levelFor(n).id).toBe('water-061');expect(validSave(n)).toBe(true);
});
