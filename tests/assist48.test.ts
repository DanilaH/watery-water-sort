import {test,expect} from 'vitest';
import {levels,allLevels,fresh,attempt,seededRestart,levelFor,activeKey,goalFor,knowledgeFor,grantExtra,reshuffled,moved,undone,validSave,restarted,type Save} from '../src/core/session';
import {extraCount,scoreMoves} from '../src/core/assist';
import {generateShuffle} from '../src/core/shuffle';
import {spendBoost,purchaseBoost,settleEconomy,parseTubeTarget,tubeTarget} from '../src/core/economy';
import {fieldHeight,layout,goalLayout} from '../src/game/geometry';
import {goalList,sealedTube,won} from '../src/core/rules';
import routes from '../src/core/optimalRoutes.json';
import {SaveStore} from '../src/platform/storage';
test('three numbered tubes are idempotent, cumulative on backup recovery, and survive history/restart/old saves',()=>{
 for(const l of allLevels.filter(l=>l.colors>2)){
  const index=levels.findIndex(v=>v.id===l.id),key=`${l.id}@${l.version}`;let s:Save={...fresh(),current:index};s.attempts[key]={board:structuredClone(l.initial),history:[],extra:false};s=seededRestart(s);
  const prefix=structuredClone(attempt(s).history);for(let n=1;n<=3;n++){s=grantExtra(s,key,n);expect(grantExtra(s,key,n)).toEqual(s);expect(extraCount(attempt(s))).toBe(n);expect(attempt(s).board).toHaveLength(l.initial.length+n);expect(validSave(s)).toBe(true);}
  expect(attempt(s).history).toEqual(prefix);expect(extraCount(attempt(restarted(s)))).toBe(3);
  const backup=seededRestart({...fresh(),current:index,attempts:{[key]:{board:structuredClone(l.initial),history:[],extra:false}}});expect(extraCount(attempt(grantExtra(backup,key,3)))).toBe(3);
 }
});
test('all cached original routes still win with three tubes; caps and forged counts are rejected',()=>{
 for(const l of allLevels.filter(l=>l.colors>2)){const i=levels.findIndex(v=>v.id===l.id),key=`${l.id}@${l.version}`;let s:Save={...fresh(),current:i,attempts:{[key]:{board:structuredClone(l.initial),history:[],extra:false}}};s=grantExtra(s,key,3);for(const m of (routes as Record<string,any[]>)[activeKey(s)+'+'])s=moved(s,m);expect(won(attempt(s).board,goalFor(s))).toBe(true);expect(validSave(s)).toBe(true);}
 const s=grantExtra({...fresh(),current:2},`${levels[2].id}@${levels[2].version}`,3);for(const extras of [-1,0,1,4,2.5]){const bad=structuredClone(s);attempt(bad).extras=extras;expect(validSave(bad)).toBe(false);}
});
test('old hint stocks retain their full count; purchases, spends and failed storage are atomic',()=>{
 const s=fresh();s.wallet!.hints=17;delete s.wallet!.tubes;delete s.wallet!.shuffles;const n=settleEconomy(s);expect(n.wallet!.hints).toBe(17);expect(n.wallet!.shuffles).toBe(17);expect(n.wallet!.tubes).toBe(3);expect(settleEconomy(n)).toEqual(n);
 n.wallet!.coins=60;const bought=purchaseBoost(n,'tube')!;expect(bought.wallet!.coins).toBe(0);expect(bought.wallet!.tubes).toBe(6);expect(spendBoost(bought,'tube')!.wallet!.tubes).toBe(5);
 const raw=JSON.stringify(n),store=new SaveStore({getItem:()=>raw,setItem:()=>{throw Error('Full');}});expect(()=>store.write(bought)).toThrow();expect(store.load().state.wallet).toEqual(n.wallet);
 expect(parseTubeTarget(tubeTarget('water-003@2',3))).toEqual({key:'water-003@2',number:3});expect(parseTubeTarget('water-003@1')).toEqual({key:'water-003@1',number:1});expect(parseTubeTarget('tube:water-003@2:4')).toBeUndefined();
});
test('proved shuffles conserve identities and special vessels; Undo, moves, added tubes, reload and retained results compose',()=>{
 let found=0;
 for(const index of [0,2,3,4,16,24,26,31,34,35,36,42,54]){
  let s=seededRestart({...fresh(),current:index}),a=attempt(s),event=generateShuffle(levelFor(s),a,goalFor(s),480000+index,400);
  if(!event)continue;found++;const before=structuredClone(a),sealed=a.board.map((_,i)=>sealedTube(a.board,i,goalFor(s)));
  s=reshuffled(s,event);expect(validSave(s)).toBe(true);expect(scoreMoves(attempt(s))).toBe(scoreMoves(before)+1);expect(attempt(s).board.flat().sort()).toEqual(before.board.flat().sort());
  sealed.forEach((yes,i)=>{if(yes)expect(attempt(s).board[i]).toEqual(before.board[i]);});for(const g of goalList(goalFor(s)))expect(attempt(s).board[g.index]).toEqual(before.board[g.index]);
  expect(attempt(undone(s)).board).toEqual(before.board);expect(attempt(undone(s)).history).toEqual(before.history);
  if(levelFor(s).colors>2)s=grantExtra(s,activeKey(s),3);expect(validSave(s)).toBe(true);
  const reloaded=JSON.parse(JSON.stringify(s));expect(validSave(reloaded)).toBe(true);s=reloaded;
  for(const m of event.path)s=moved(s,m);expect(won(attempt(s).board,goalFor(s))).toBe(true);expect(validSave(s)).toBe(true);expect(s.best![activeKey(s)].shuffles).toHaveLength(1);
  for(const _ of event.path)s=undone(s);expect(attempt(s).shuffles).toHaveLength(1);s=undone(s);expect(attempt(s).shuffles).toBeUndefined();expect(s.best![activeKey(s)].shuffles).toHaveLength(1);expect(validSave(s)).toBe(true);
 }
 expect(found).toBeGreaterThanOrEqual(9);
});
test('shuffle tampering cannot forge units, winning routes or chronology',()=>{
 const s=seededRestart({...fresh(),current:2}),e=generateShuffle(levelFor(s),attempt(s),goalFor(s),48001)!;expect(e).toBeDefined();
 for(const mutate of [(x:any)=>x.ids[0][0]=999,(x:any)=>x.path=[],(x:any)=>x.at=-1,(x:any)=>x.board[0][0]=7]){const bad=structuredClone(e);mutate(bad);expect(()=>reshuffled(s,bad)).toThrow();}
});
test('up to thirteen real vessels retain exclusive 48px targets using the minimum scrollable field height',()=>{
 for(const [w,h]of [[288,210],[288,300],[358,580],[536,150]])for(const count of [11,12,13])for(const goals of [0,1,2]){
  const height=fieldHeight(w,h,count,goals),p=goals?goalLayout(w,height,count,Array.from({length:goals},(_,i)=>i)):layout(w,height,count);
  for(const t of p){expect(t.hitW).toBeGreaterThanOrEqual(48);expect(t.hitH).toBeGreaterThanOrEqual(48);expect(t.y+t.h).toBeLessThanOrEqual(height+1);}
  for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){const a=p[i],b=p[j];expect(Math.abs(a.x-b.x)>=(a.hitW+b.hitW)/2||Math.abs(a.y+a.h/2-b.y-b.h/2)>=(a.hitH+b.hitH)/2).toBe(true);}
 }
});
