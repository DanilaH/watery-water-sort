import {startGame,reloadGame,openLevels,resumeGame} from './navigation';
import {test,expect,type Page} from '@playwright/test';
import {advanceFrames} from './controlled-frames';
import {readFileSync} from 'node:fs';
import {layout} from '../../src/game/geometry';
const levels=JSON.parse(readFileSync(new URL('../../src/core/levels.json',import.meta.url),'utf8'));
const points=new WeakMap<Page,{x:number;y:number}[]>();
async function open(page:Page,fast=false){
 await page.addInitScript(fast=>{if(sessionStorage.feel10)return;sessionStorage.feel10='1';localStorage.setItem('water-sort-v1',JSON.stringify({schema:1,artVersion:4,current:0,revision:0,completed:[],attempts:{},settings:{sound:true,fast,symbols:false,light:false}}));},fast);
 await startGame(page);await page.locator('canvas').waitFor();await page.waitForTimeout(300);
 const b=(await page.locator('#board').boundingBox())!;points.set(page,layout(b.width,b.height,4).map(p=>({x:b.x+p.x,y:b.y+p.y+p.h/2})));
 await page.evaluate(async()=>{(window as any).hadQueue=false;new MutationObserver(()=>{if(document.getElementById('status')!.textContent!.includes('Следующий ход выбран'))(window as any).hadQueue=true;}).observe(document.getElementById('status')!,{subtree:true,childList:true,characterData:true});const p='/src/audio/sound.ts',m=await import(p);(window as any).cues=[];for(const key of ['tap','accept','pour','land','finish','stop']){const f=m.Sound.prototype[key];m.Sound.prototype[key]=function(...args:any[]){(window as any).cues.push({key,args,time:performance.now()});return f.apply(this,args);};}});
}
async function tap(page:Page,i:number){const p=points.get(page)![i];await page.mouse.click(p.x,p.y);}
async function cues(page:Page){return page.evaluate(()=>(window as any).cues as {key:string;args:any[];time:number}[]);}
for(const fast of [false,true])test(`ordinary and queued acceptance acknowledge once (${fast?'fast':'normal'})`,async({page})=>{
 await page.clock.install();await open(page,fast);await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.animate;m.WaterScene.prototype.animate=function(...a:any[]){(window as any).feelQueueScene=this;return fn.apply(this,a);};});await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));await tap(page,0);await tap(page,2);await tap(page,1);await tap(page,0);expect(await page.evaluate(()=>(window as any).hadQueue)).toBe(true);
 expect((await cues(page)).filter(c=>c.key==='accept')).toHaveLength(2);await advanceFrames(page,'feelQueueScene',1800);await page.clock.resume();await expect(page.locator('#moves')).toHaveText('Ходов: 2');await expect(page.locator('#hint')).toBeEnabled();
 const log=await cues(page);expect(log.filter(c=>c.key==='accept')).toHaveLength(2);expect(log.filter(c=>c.key==='pour')).toHaveLength(2);expect(log.findIndex(c=>c.key==='accept')).toBeLessThan(log.findIndex(c=>c.key==='pour'));
});
test('new color rewards once, relocation only lands, victory has one final accent',async({page})=>{
 await open(page);for(const m of levels[0].witness.slice(0,2)){await tap(page,m.from);await tap(page,m.to);await expect(page.locator('#hint')).toBeEnabled();}
 expect((await cues(page)).filter(c=>c.key==='finish').map(c=>c.args[0])).toEqual([false]);
 await page.evaluate(()=>(window as any).cues=[]);await tap(page,1);await tap(page,2);await expect(page.locator('#hint')).toBeEnabled();let log=await cues(page);expect(log.filter(c=>c.key==='finish')).toHaveLength(0);expect(log.filter(c=>c.key==='land')).toHaveLength(1);
 await tap(page,3);await tap(page,0);await expect(page.locator('#continue')).toBeVisible();log=await cues(page);expect(log.filter(c=>c.key==='finish').map(c=>c.args[0])).toEqual([true]);
});
test('failed persistence does not play an acceptance cue',async({page})=>{
 await open(page);await page.evaluate(()=>{const f=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('water-sort-v1'))throw Error('full');f.call(this,k,v);};});await tap(page,0);await tap(page,2);await expect(page.locator('#status')).toContainText('Изменение не принято');expect((await cues(page)).filter(c=>c.key==='accept'||c.key==='pour')).toHaveLength(0);
});
for(const interrupt of ['undo','resize'])test(`${interrupt} cancels future water and completion cues`,async({page})=>{
 await open(page);await tap(page,0);await tap(page,2);if(interrupt==='undo')await page.locator('#undo').click();else await page.setViewportSize({width:568,height:320});
 await page.waitForTimeout(650);const log=await cues(page);const stopped=log.filter(c=>c.key==='stop').at(-1)!;expect(stopped).toBeDefined();expect(log.filter(c=>c.time>=stopped.time&&(c.key==='pour'||c.key==='finish'))).toHaveLength(0);await expect(page.locator('#hint')).toBeEnabled();
 const b=(await page.locator('#board').boundingBox())!;await page.mouse.click(b.x+1,b.y+1);
});
test('layered audio keeps its voice budget and stops every owned voice',async({page})=>{
 await open(page);const result=await page.evaluate(async()=>{const p='/src/audio/sound.ts',m=await import(p),s=new m.Sound();await s.load();await s.context.resume();let peak=0;for(let i=0;i<10;i++){s.accept();s.pour(180,2,0,.5);s.finish(i===9,i);peak=Math.max(peak,s.voices.length);}s.stop();await new Promise(r=>setTimeout(r,100));const active=s.voices.length;await s.context.close();return {peak,active};});expect(result.peak).toBeLessThanOrEqual(4);expect(result.active).toBe(0);
});

test('incoming liquid reacts during the real flow, without a flashing hint button',async({page})=>{
 await page.clock.install();await open(page);await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.surfaceWave;(window as any).waterWaves=[];m.WaterScene.prototype.surfaceWave=function(i:number,now:number,...rest:any[]){const value=fn.call(this,i,now,...rest),f=this.flight;(window as any).waveScene=this;if(f?.to===i&&!f.received&&now>=f.start+f.timing.lift)(window as any).waterWaves.push(value);return value;};});
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));await tap(page,0);await tap(page,2);await expect(page.locator('body')).toHaveClass(/pouring/);await expect(page.locator('#hint')).toBeDisabled();expect(Number(await page.locator('#hint').evaluate(e=>getComputedStyle(e).opacity))).toBeGreaterThan(.7);await advanceFrames(page,'waveScene',800);await expect(page.locator('#hint')).toBeEnabled();
 const samples=await page.evaluate(()=>(window as any).waterWaves as number[]);expect(samples.some(x=>Math.abs(x)>.2)).toBe(true);await expect(page.locator('body')).not.toHaveClass(/pouring/);await page.clock.resume();
});

test('victory accents every completed color and next level cancels the accent immediately',async({page})=>{
 await open(page);await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.celebrate;m.WaterScene.prototype.celebrate=function(...args:any[]){const r=fn.apply(this,args);(window as any).resultScene=this;return r;};});
 for(const move of levels[0].witness){await tap(page,move.from);await tap(page,move.to);if(move!==levels[0].witness.at(-1))await expect(page.locator('#hint')).toBeEnabled();}
 await expect(page.locator('#continue')).toBeVisible();const data=await page.evaluate(()=>{const s=(window as any).resultScene;return {busy:s.busy,colors:[...new Set(s.bursts.filter((b:any)=>b.final).map((b:any)=>b.index))],resultBottom:document.getElementById('feedback')!.getBoundingClientRect().bottom,controlsTop:document.getElementById('undo')!.getBoundingClientRect().top};});expect(data.busy).toBe(false);expect(data.colors).toHaveLength(2);expect(data.resultBottom).toBeLessThanOrEqual(data.controlsTop);
 await page.locator('#continue').click();await expect(page.locator('#level-title')).toHaveText('Уровень 2');expect(await page.evaluate(()=>(window as any).resultScene.bursts.length)).toBe(0);
});
