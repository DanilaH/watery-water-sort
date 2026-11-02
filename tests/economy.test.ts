import {test,expect} from 'vitest';
import {fresh,levels,moved,restarted,undone,validSave,levelKey,attempt,goalFor,levelGoals} from '../src/core/session';
import {settleEconomy,purchaseHints,creditCoins,ownHint,adviceKey} from '../src/core/economy';
import {SaveStore} from '../src/platform/storage';
import {solveHint} from '../src/core/hintSolver';
import {stars,targets} from '../src/core/ratings';
import {transition,won} from '../src/core/rules';
function win(){let s=fresh();for(const m of levels[0].witness)s=moved(s,m);return settleEconomy(s);}
test('stars credit once, survive undo/replay, and improvement only pays its difference',()=>{
 let s=win();expect(s.wallet?.coins).toBe(30);expect(settleEconomy(s).wallet?.coins).toBe(30);s=settleEconomy(undone(s));expect(s.wallet?.coins).toBe(30);s=settleEconomy(moved(s,levels[0].witness.at(-1)!));expect(s.wallet?.coins).toBe(30);
 const partial=win();partial.wallet!.awarded[levels[0].id]=1;partial.wallet!.coins=10;expect(settleEconomy(partial).wallet!.coins).toBe(30);
});
test('legacy migration credits retained stars once and never invents three stars from completion alone',()=>{
 const s=win();delete s.wallet;delete s.best;const map=new Map([['water-sort-v1',JSON.stringify({...s,attempts:{}})]]);const store=new SaveStore({getItem:k=>map.get(k)??null,setItem:(k,v)=>{map.set(k,v);}});const loaded=store.load().state;expect(loaded.wallet!.coins).toBe(10);expect(loaded.wallet!.hints).toBe(3);store.write(loaded);expect(store.load().state.wallet).toEqual(loaded.wallet);
});
test('purchase is one atomic wallet change, and insufficient coins change nothing',()=>{
 const s=fresh();expect(purchaseHints(s)).toBeUndefined();s.wallet!.coins=80;const n=purchaseHints(s)!;expect(n.wallet).toMatchObject({coins:20,hints:6});expect(s.wallet).toMatchObject({coins:80,hints:3});expect(validSave(n)).toBe(true);
});
test('earned coin receipts are idempotent, immutable offers survive retries, and a new offer may earn again',()=>{
 let s=fresh();s.wallet!.adOrder='coins:first';s=creditCoins(s,'receipt-a','coins:first')!;expect(s.wallet!.coins).toBe(80);expect(creditCoins(s,'receipt-a','coins:first')).toBe(s);expect(creditCoins(s,'receipt-b','unsupported:unknown')).toBeUndefined();s.wallet!.adOrder='coins:second';s=creditCoins(s,'receipt-b','coins:second')!;expect(s.wallet!.coins).toBe(160);expect(creditCoins(s,'receipt-a','coins:first')).toBe(s);
});
test('only successful new advice consumes inventory and same-board advice survives reload',()=>{
 let s=restarted({...fresh(),current:2});const key=adviceKey(s),m=levels[2].witness[0];s=ownHint(s,key,m)!;expect(s.wallet!.hints).toBe(2);expect(ownHint(s,key,m)).toBe(s);expect(ownHint(JSON.parse(JSON.stringify(s)),key,m)!.wallet!.hints).toBe(2);s.wallet!.hints=0;expect(ownHint(s,'other',m)).toBeUndefined();expect(ownHint(s,'other',m,true)!.wallet!.hints).toBe(0);
});
test('wallet validation rejects corrupt numbers, receipt duplicates and malformed orders',()=>{
 for(const change of [{coins:-1},{hints:NaN},{coins:Infinity},{receipts:['x','x']},{adOrder:'wrong'},{adAfter:-1}]){const s=fresh();Object.assign(s.wallet!,change);expect(validSave(s)).toBe(false);}
});
test('all 120 initial configurations receive verified optimal advice, without a DFS quality penalty',()=>{
 for(let i=0;i<levels.length;i++)for(const extra of [false,true]){const l=levels[i],board=extra?[...l.initial,[]]:l.initial,g=levelGoals(l),r=solveHint(board,g,levelKey(i),extra);expect(r.status).toBe('FOUND');if(r.status!=='FOUND')continue;let next={board,rules:g};for(const m of r.path)next=transition(next.board,m,next.rules);expect(won(next.board,next.rules)).toBe(true);expect(stars(levelKey(i),r.path.length)).toBe(3);if(!extra)expect(r.path.length).toBe(targets(levelKey(i)).three);}
});
test('optimal route is retained after each advised move and ignores a mismatching level seed',()=>{
 const i=4,l=levels[i];let current={board:l.initial,rules:levelGoals(l)},r=solveHint(current.board,current.rules,levelKey(i));if(r.status!=='FOUND')throw Error('No path');const count=r.path.length;for(let step=0;step<count;step++){r=solveHint(current.board,current.rules,levelKey(i));expect(r.status).toBe('FOUND');if(r.status!=='FOUND')break;expect(r.path).toHaveLength(count-step);current=transition(current.board,r.path[0],current.rules);}expect(won(current.board,current.rules)).toBe(true);
 const wrong=solveHint(levels[2].initial,levelGoals(levels[2]),levelKey(0),false,200);expect(wrong.status).toBe('FOUND');if(wrong.status==='FOUND'){let b={board:levels[2].initial,rules:levelGoals(levels[2])};for(const m of wrong.path)b=transition(b.board,m,b.rules);expect(won(b.board,b.rules)).toBe(true);}
});

test('native earned coins survive recovering a game backup from before the offer',()=>{const s=fresh();const n=creditCoins(s,'durable-native-proof','coins:old-offer')!;expect(n.wallet!.coins).toBe(80);expect(n.wallet!.receipts).toEqual(['durable-native-proof']);expect(creditCoins(n,'durable-native-proof','coins:old-offer')).toBe(n);});
