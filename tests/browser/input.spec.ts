import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {layout} from '../../src/game/geometry';
const levels=JSON.parse(readFileSync(new URL('../../src/core/levels.json',import.meta.url),'utf8'));
const initial=()=>({schema:1,artVersion:4,current:0,revision:0,completed:[],attempts:{},settings:{sound:true,fast:false,symbols:false,light:false}});
const hitPoints=new WeakMap<Page,{x:number;y:number}[]>();
async function open(page:Page,state:unknown=initial()){
 await page.addInitScript(s=>{if(sessionStorage.getItem('input-test-seeded'))return;localStorage.setItem('water-sort-v1',JSON.stringify(s));sessionStorage.setItem('input-test-seeded','1');},state);
 await page.goto('/');await page.locator('canvas').waitFor();await page.waitForTimeout(120);const b=(await page.locator('#board').boundingBox())!;hitPoints.set(page,layout(b.width,b.height,4).map(p=>({x:b.x+p.x,y:b.y+p.y+p.h/2})));
}
async function tap(page:Page,i:number){const p=hitPoints.get(page)![i];await page.mouse.click(p.x,p.y);}
async function history(page:Page){return page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('water-sort-v1')!).attempts).flatMap((a:any)=>a.history) as {from:number;to:number}[]);}
async function queueFirstChain(page:Page){await tap(page,0);await tap(page,2);await tap(page,1);await tap(page,0);await expect(page.locator('#status')).toContainText('Следующий ход выбран');}

for(const fast of [false,true])test(`queues a next move into the source of the current pour (${fast?'fast':'normal'})`,async({page})=>{
 const state=initial();state.settings.fast=fast;await open(page,state);await queueFirstChain(page);expect(await history(page)).toHaveLength(1);await expect.poll(async()=>(await history(page)).length).toBe(2);await expect(page.locator('#hint')).toBeEnabled();expect((await history(page)).map(m=>[m.from,m.to])).toEqual([[0,2],[1,0]]);
});

test('replacement can use the recipient of the current pour as its next source',async({page})=>{
 await open(page);await queueFirstChain(page);await tap(page,2);await expect(page.locator('#status')).toContainText('выбери колбу назначения');await tap(page,3);await expect.poll(async()=>(await history(page)).length).toBe(2);await expect(page.locator('#hint')).toBeEnabled();expect((await history(page)).map(m=>[m.from,m.to])).toEqual([[0,2],[2,3]]);
});

test('a half-selected next move survives the end of the current animation',async({page})=>{
 await open(page);await tap(page,0);await tap(page,2);await tap(page,1);await expect(page.locator('#status')).toContainText('Следующий ход:');await expect(page.locator('#hint')).toBeEnabled();await tap(page,0);expect((await history(page)).map(m=>[m.from,m.to])).toEqual([[0,2],[1,0]]);
});

for(const stage of ['current','queued'])test(`undo cancels all pending input during the ${stage} move`,async({page})=>{
 await open(page);await queueFirstChain(page);if(stage==='queued'){await expect.poll(async()=>(await history(page)).length).toBe(2);await expect(page.locator('#hint')).toBeDisabled();}await page.locator('#undo').click({force:true});await expect(page.locator('#hint')).toBeEnabled();expect(await history(page)).toHaveLength(stage==='queued'?1:0);await expect(page.locator('#continue')).not.toBeVisible();
});

test('reload retains only accepted moves, never the pending intention',async({page})=>{
 await open(page);await queueFirstChain(page);await page.reload();await page.locator('canvas').waitFor();await page.waitForTimeout(1250);expect((await history(page)).map(m=>[m.from,m.to])).toEqual([[0,2]]);
});

test('a queued winning move completes once and remains actionable after reload',async({page})=>{
 await open(page,initial());await page.evaluate(async()=>{const path='/src/audio/sound.ts',m=await import(path),original=m.Sound.prototype.finish;(window as any).__wins=0;m.Sound.prototype.finish=function(won:boolean,sequence:number){if(won)(window as any).__wins++;return original.call(this,won,sequence);};});
 const first=levels[0].witness[0];await tap(page,first.from);await tap(page,first.to);await expect(page.locator('#hint')).toBeEnabled();
 for(const m of levels[0].witness.slice(1)){await tap(page,m.from);await tap(page,m.to);}
 await expect(page.locator('#status')).toContainText('Следующий ход выбран');await expect(page.locator('#continue')).not.toBeVisible();await expect(page.locator('#continue')).toBeVisible();expect(await history(page)).toHaveLength(3);expect(await page.evaluate(()=>(window as any).__wins)).toBe(1);
 await page.reload();await page.locator('canvas').waitFor();await expect(page.locator('#continue')).toBeVisible();await page.locator('#continue').click({force:true});await expect(page.locator('#level-title')).toHaveText('Уровень 2');
});

test('switching a full incompatible source emits only the selection cue',async({page})=>{
 await open(page);await page.evaluate(async()=>{const path='/src/audio/sound.ts',m=await import(path);(window as any).__cues=[];for(const key of ['tap','reject']){const original=m.Sound.prototype[key];m.Sound.prototype[key]=function(){(window as any).__cues.push(key);return original.call(this);};}});
 await tap(page,0);await tap(page,1);expect(await page.evaluate(()=>(window as any).__cues)).toEqual(['tap','tap']);await expect(page.locator('#status')).not.toContainText('полная');await tap(page,3);expect((await history(page)).map(m=>[m.from,m.to])).toEqual([[1,3]]);
});

test('no-move state offers undo without blocking the board',async({page})=>{
 const state=JSON.parse(readFileSync(new URL('../../docs/audits/review-05/deadend-save.json',import.meta.url),'utf8'));await open(page,state);await expect(page.locator('#status')).toContainText('Нет доступных ходов');await expect(page.locator('dialog')).not.toBeVisible();await expect(page.locator('#undo')).toBeEnabled();await page.locator('#undo').click({force:true});await expect(page.locator('#hint')).toBeEnabled();await expect(page.locator('#moves')).toHaveText('Ходов: 6');await expect(page.locator('#status')).not.toContainText('Нет доступных ходов');
});

test('restart is direct before the first move and confirmed when history would be lost',async({page})=>{
 await open(page);await tap(page,0);await page.locator('#restart').click({force:true});await expect(page.locator('dialog')).not.toBeVisible();expect(await history(page)).toHaveLength(0);
 await tap(page,0);await tap(page,2);await page.locator('#restart').click({force:true});await expect(page.locator('dialog')).toBeVisible();await page.getByRole('button',{name:'Продолжить',exact:true}).click({force:true});expect(await history(page)).toHaveLength(1);
 await page.locator('#restart').click({force:true});await page.getByRole('button',{name:'Начать заново',exact:true}).click({force:true});await expect(page.locator('dialog')).not.toBeVisible();expect(await history(page)).toHaveLength(0);
});
