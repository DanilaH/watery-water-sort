import {advanceFrames} from './controlled-frames';
import {startGame,reloadGame,openLevels,resumeGame,slotCount} from './navigation';
import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {layout} from '../../src/game/geometry';
const levels=JSON.parse(readFileSync(new URL('../../src/core/levels.json',import.meta.url),'utf8'));
const initial=()=>({schema:1,artVersion:4,current:0,revision:0,completed:[],attempts:{},settings:{sound:true,fast:false,symbols:false,light:false}});
const hitPoints=new WeakMap<Page,{x:number;y:number}[]>();
async function open(page:Page,state:unknown=initial()){
 await page.addInitScript(s=>{if(sessionStorage.getItem('input-test-seeded'))return;localStorage.setItem('water-sort-v1',JSON.stringify(s));sessionStorage.setItem('input-test-seeded','1');},state);
 await startGame(page);await page.locator('canvas').waitFor();await page.waitForTimeout(120);const b=(await page.locator('#board').boundingBox())!;hitPoints.set(page,layout(b.width,b.height,4).map(p=>({x:b.x+p.x,y:b.y+p.y+p.h/2})));
}
// Keep the intention pending while remote pointer events/assertions travel to the browser.
async function openFrozen(page:Page,state:unknown=initial()){await page.clock.install();await open(page,state);await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));}
async function tap(page:Page,i:number){const p=hitPoints.get(page)![i];await page.mouse.click(p.x,p.y);}
async function history(page:Page){return page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('water-sort-v1')!).attempts).flatMap((a:any)=>a.history) as {from:number;to:number}[]);}
async function queueFirstChain(page:Page){await tap(page,0);await tap(page,2);await tap(page,1);await tap(page,0);await expect(page.locator('#status')).toContainText('Следующий ход выбран');}

for(const fast of [false,true])test(`queues a next move into the source of the current pour (${fast?'fast':'normal'})`,async({page})=>{
 const state=initial();state.settings.fast=fast;await openFrozen(page,state);await queueFirstChain(page);expect(await history(page)).toHaveLength(1);await page.clock.resume();await expect.poll(async()=>(await history(page)).length).toBe(2);await expect(page.locator('#hint')).toBeEnabled();expect((await history(page)).map(m=>[m.from,m.to])).toEqual([[0,2],[1,0]]);
});

test('replacement can use the recipient of the current pour as its next source',async({page})=>{
 await openFrozen(page);await queueFirstChain(page);await tap(page,2);await expect(page.locator('#status')).toContainText('выбери цель');await tap(page,3);expect(await history(page)).toHaveLength(1);await page.clock.resume();await expect.poll(async()=>(await history(page)).length).toBe(2);await expect(page.locator('#hint')).toBeEnabled();expect((await history(page)).map(m=>[m.from,m.to])).toEqual([[0,2],[2,3]]);
});

test('a half-selected next move survives the end of the current animation',async({page})=>{
 await openFrozen(page);await tap(page,0);await tap(page,2);await tap(page,1);await expect(page.locator('#status')).toContainText('Следующий ход:');await page.clock.resume();await expect(page.locator('#hint')).toBeEnabled();await tap(page,0);expect((await history(page)).map(m=>[m.from,m.to])).toEqual([[0,2],[1,0]]);
});

for(const stage of ['current','queued'])test(`undo cancels all pending input during the ${stage} move`,async({page})=>{
 await openFrozen(page);
 // Trigger in the same event-loop turn as the target state. A remote click may arrive
 // after the first flight has ended, especially with the shorter material rhythm.
 await page.evaluate(stage=>{
  (window as any).autoUndo=null;
  const target=document.getElementById(stage==='current'?'status':'moves')!;
  const observer=new MutationObserver(()=>{
   const ready=stage==='current'?target.textContent!.includes('Следующий ход выбран'):target.textContent==='Ходов: 2';
   if(!ready)return;observer.disconnect();
   const save=JSON.parse(localStorage.getItem('water-sort-v1')!);
   (window as any).autoUndo={before:Object.values(save.attempts).flatMap((a:any)=>a.history).length,busy:(document.getElementById('hint') as HTMLButtonElement).disabled};
   document.getElementById('undo')!.click();
  });observer.observe(target,{subtree:true,childList:true,characterData:true});
 },stage);
 await tap(page,0);await tap(page,2);await tap(page,1);await tap(page,0);await page.clock.resume();
 await expect.poll(()=>page.evaluate(()=>(window as any).autoUndo)).not.toBeNull();
 expect(await page.evaluate(()=>(window as any).autoUndo)).toEqual({before:stage==='queued'?2:1,busy:true});
 await expect(page.locator('#hint')).toBeEnabled();expect(await history(page)).toHaveLength(stage==='queued'?1:0);
 await page.waitForTimeout(550);expect(await history(page)).toHaveLength(stage==='queued'?1:0);await expect(page.locator('#continue')).not.toBeVisible();
});

test('reload retains only accepted moves, never the pending intention',async({page})=>{
 await openFrozen(page);await queueFirstChain(page);expect(await history(page)).toHaveLength(1);await reloadGame(page);await page.clock.resume();await page.locator('canvas').waitFor();await page.waitForTimeout(1250);expect((await history(page)).map(m=>[m.from,m.to])).toEqual([[0,2]]);
});

test('a queued winning move completes once and remains actionable after reload',async({page})=>{
 await page.clock.install();await open(page,initial());await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.animate;m.WaterScene.prototype.animate=function(...a:any[]){(window as any).queuedWinScene=this;return fn.apply(this,a);};});await page.evaluate(async()=>{const path='/src/audio/sound.ts',m=await import(path),original=m.Sound.prototype.finish;(window as any).__wins=0;m.Sound.prototype.finish=function(won:boolean,sequence:number){if(won)(window as any).__wins++;return original.call(this,won,sequence);};});
 const first=levels[0].witness[0];await tap(page,first.from);await tap(page,first.to);await expect(page.locator('#hint')).toBeEnabled();await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));
 for(const m of levels[0].witness.slice(1)){await tap(page,m.from);await tap(page,m.to);}
 await expect(page.locator('#status')).toContainText('Следующий ход выбран');await expect(page.locator('#continue')).not.toBeVisible();await advanceFrames(page,'queuedWinScene',3000);await page.clock.resume();await expect(page.locator('#continue')).toBeVisible();expect(await history(page)).toHaveLength(3);expect(await page.evaluate(()=>(window as any).__wins)).toBe(1);
 await reloadGame(page);await page.locator('canvas').waitFor();await expect(page.locator('#continue')).toBeVisible();await page.locator('#continue').click({force:true});await expect(page.locator('#level-title')).toHaveText('Уровень 2');
});

test('switching a full incompatible source emits only the selection cue',async({page})=>{
 await open(page);await page.evaluate(async()=>{const path='/src/audio/sound.ts',m=await import(path);(window as any).__cues=[];for(const key of ['tap','reject']){const original=m.Sound.prototype[key];m.Sound.prototype[key]=function(){(window as any).__cues.push(key);return original.call(this);};}});
 await tap(page,0);await tap(page,1);expect(await page.evaluate(()=>(window as any).__cues)).toEqual(['tap','tap']);await expect(page.locator('#status')).not.toContainText('полная');await tap(page,3);expect((await history(page)).map(m=>[m.from,m.to])).toEqual([[1,3]]);
});

test('no-move state offers undo without blocking the board',async({page})=>{
 const state=JSON.parse(readFileSync(new URL('../../docs/audits/review-05/deadend-save.json',import.meta.url),'utf8'));await open(page,state);await expect(page.locator('#status')).toContainText('Нет доступных ходов');await expect(page.locator('dialog')).not.toBeVisible();await expect(page.locator('#undo')).toBeEnabled();await page.locator('#undo').click({force:true});await expect(page.locator('#hint')).toBeEnabled();await expect(page.locator('#moves')).toHaveText('Ходов: 6');await expect(page.locator('#status')).not.toContainText('Нет доступных ходов');
});

test('restart always asks, including before the first move',async({page})=>{
 await open(page);await tap(page,0);await page.locator('#restart').click({force:true});await expect(page.locator('dialog')).toBeVisible();await page.getByRole('button',{name:'Продолжить игру',exact:true}).click();expect(await history(page)).toHaveLength(0);
 await tap(page,0);await tap(page,2);await page.locator('#restart').click({force:true});await expect(page.locator('dialog')).toBeVisible();await page.getByRole('button',{name:'Продолжить игру',exact:true}).click({force:true});expect(await history(page)).toHaveLength(1);
 await page.locator('#restart').click({force:true});await page.getByRole('button',{name:'Начать заново',exact:true}).click({force:true});await expect(page.locator('dialog')).not.toBeVisible();expect(await history(page)).toHaveLength(0);
});

for(const dense of [false,true])test(`queue badge belongs to its source (${dense?'dense small field':'tutorial'})`,async({page})=>{
 const state=initial();state.current=dense?11:0;state.completed=dense?levels.slice(0,11).map((l:any)=>l.id):[];
 if(dense)await page.setViewportSize({width:320,height:480});
 await openFrozen(page,state);
 const b=(await page.locator('#board').boundingBox())!,ps=layout(b.width,b.height,await slotCount(page));
 const click=async(i:number)=>page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);
 const [first,next]=levels[state.current].witness;
 for(const m of [first,next]){await click(m.from);await click(m.to);}
 await expect(page.locator('#status')).toContainText('Следующий ход выбран');
 await page.mouse.click(b.x+ps[next.from].x,b.y+ps[next.from].y-15);
 await expect(page.locator('#status')).toContainText('Следующий ход:');
 await click(next.to);await page.clock.resume();await expect.poll(async()=>(await history(page)).length).toBe(2);
 expect((await history(page)).map(m=>[m.from,m.to])).toEqual([[first.from,first.to],[next.from,next.to]]);
});

test('raised rim remains part of the selected tube',async({page})=>{
 await open(page);const b=(await page.locator('#board').boundingBox())!,p=layout(b.width,b.height,4)[0];
 await page.evaluate(async()=>{const path='/src/audio/sound.ts',m=await import(path),original=m.Sound.prototype.tap;(window as any).__taps=0;m.Sound.prototype.tap=function(){(window as any).__taps++;return original.call(this);};});
 await tap(page,0);await page.waitForTimeout(400);
 await page.mouse.click(b.x+p.x,b.y+p.y-13);
 expect(await page.evaluate(()=>(window as any).__taps)).toBe(2);
 await tap(page,2);await expect(page.locator('#status')).toContainText('Сначала выбери');
});

test('modal actions keep 48px targets and all settings stay reachable',async({page})=>{
 await page.setViewportSize({width:568,height:320});await open(page);await page.locator('#settings').click();
 const button=page.getByRole('button',{name:'Готово',exact:true});expect((await button.boundingBox())!.height+0.001).toBeGreaterThanOrEqual(48);
 const theme=page.getByRole('button',{name:'Лёд',exact:true});await theme.scrollIntoViewIfNeeded();await theme.click();await expect(page.locator('body')).toHaveClass(/light/);await button.click();await expect(page.locator('dialog')).not.toBeVisible();
});
