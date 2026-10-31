import {test,expect} from 'vitest';
import {campaign,stageNumber,nextLevel,continuation,available,migrateCampaign} from '../src/core/campaign';
import {fresh,levels,moved,attempt,restarted,undone,expanded,validSave,levelKey} from '../src/core/session';
import {SaveStore} from '../src/platform/storage';

test('every stable puzzle appears once; tutorials precede combinations and dense fields arrive late',()=>{
 expect(campaign).toHaveLength(40);expect(new Set(campaign).size).toBe(40);expect(campaign.slice(0,4)).toEqual([0,1,2,12]);expect(campaign.at(-1)).toBe(11);expect(campaign[35]).toBe(30);expect(stageNumber(18)).toBeLessThan(stageNumber(21));
 const prerequisites=[['mini',23],['ice',29],['hidden',35]] as const;
 for(const [role,intro]of prerequisites)for(const i of campaign.filter(i=>levels[i][role]!==undefined))expect(stageNumber(i)).toBeGreaterThanOrEqual(stageNumber(intro-1));
 expect(stageNumber(12)).toBeLessThan(stageNumber(16));expect(stageNumber(16)).toBeLessThan(stageNumber(27));
 for(const i of campaign.filter(i=>levels[i].colors>=6))expect(stageNumber(i)).toBeGreaterThanOrEqual(26);
 for(let i=0;i<campaign.length;i++)expect(nextLevel(campaign[i])).toBe(campaign[i+1]);
});

test('a fresh player can complete the whole reordered campaign without a lock, loop or invented result',()=>{
 let s=fresh();const seen=new Set<number>();
 for(const index of campaign){expect(s.current).toBe(index);expect(available(s,index)).toBe(true);expect(seen.has(index)).toBe(false);seen.add(index);
  for(const m of levels[index].witness)s=moved(s,m);expect(validSave(s)).toBe(true);
  const next=continuation(s);if(next!==undefined){expect(available(s,next)).toBe(true);s=restarted({...s,current:next});}
 }
 expect(continuation(s)).toBeUndefined();expect(s.completed).toHaveLength(40);expect(Object.keys(s.best!)).toHaveLength(40);
});

test('legacy migration retains all old frontiers and in-progress state for every campaign position',()=>{
 for(let current=0;current<40;current++){
  let old={...fresh(),current,completed:levels.slice(0,current).map(l=>l.id)};delete old.campaignVersion;
  old=moved(old,levels[current].witness[0]);const before=structuredClone(old),up=migrateCampaign(old);
  expect(up.current).toBe(current);expect(up.attempts).toEqual(old.attempts);expect(up.best).toEqual(old.best);expect(up.completed).toEqual(old.completed);expect(up.revision).toBe(old.revision);expect(old).toEqual(before);expect(validSave(up)).toBe(true);expect(migrateCampaign(up)).toBe(up);
  for(let i=0;i<40;i++)if(i===0||i===current||old.completed.includes(levels[i].id)||i>0&&old.completed.includes(levels[i-1].id))expect(available(up,i)).toBe(true);
 }
});

test('finishing a resumed late legacy puzzle leads to the earliest missing lesson, without restarting the attempt',()=>{
 let s={...fresh(),current:7,completed:levels.slice(0,7).map(l=>l.id)};delete s.campaignVersion;s=migrateCampaign(s);
 for(const m of levels[7].witness)s=moved(s,m);expect(continuation(s)).toBe(12);expect(stageNumber(continuation(s)!)).toBe(4);expect(s.best?.[levelKey(7)].history).toEqual(levels[7].witness);
 const partial={...s,current:11,completed:levels.slice(0,12).map(l=>l.id)};expect(continuation(partial)).toBe(12);
});

test('frontier survives reload, Undo and restarted attempts; new players do not inherit old linear unlocks',()=>{
 let s={...fresh(),current:12,completed:[levels[0].id,levels[1].id,levels[2].id]};for(const m of levels[12].witness)s=moved(s,m);expect(available(s,3)).toBe(true);s=undone(s);expect(available(s,3)).toBe(true);s=restarted(s);expect(available(s,3)).toBe(true);
 expect(available(fresh(),12)).toBe(false);expect(available({...fresh(),completed:[levels[11].id]},12)).toBe(false);
 const keys=new Map<string,string>(),store=new SaveStore({getItem:k=>keys.get(k)??null,setItem:(k,v)=>{keys.set(k,v);}});store.write(s);expect(store.load().state).toEqual(s);
});

test('earned extra tube and hidden knowledge retain stable identity across migration and navigation',()=>{
 let s=expanded({...fresh(),current:34});for(const m of levels[34].witness.slice(0,4))s=moved(s,m);delete s.campaignVersion;const original=structuredClone(attempt(s)),up=migrateCampaign(s);
 expect(attempt(up)).toEqual(original);expect(attempt(restarted(up)).known).toEqual(original.known);expect(attempt(restarted(up)).extra).toBe(true);expect(validSave(up)).toBe(true);
});

test('invalid campaign metadata rejects corrupt snapshots; legacy snapshots remain accepted',()=>{
 const old=fresh();delete old.campaignVersion;expect(validSave(old)).toBe(true);
 for(const bad of [{campaignVersion:2},{unlocked:['made-up']},{unlocked:[levels[0].id,levels[0].id]},{unlocked:'water-001'}])expect(validSave({...fresh(),...bad})).toBe(false);
});

test('loading an old save upgrades in memory without writing to unavailable storage',()=>{
 const old=fresh();delete old.campaignVersion;let writes=0;const store=new SaveStore({getItem:k=>k==='water-sort-v1'?JSON.stringify(old):null,setItem:()=>{writes++;throw Error('unavailable');}});
 const loaded=store.load();expect(writes).toBe(0);expect(loaded.state.campaignVersion).toBe(1);expect(loaded.state.completed).toEqual([]);expect(loaded.state.best).toEqual({});expect(loaded.state.unlocked).toEqual([levels[0].id]);
});
