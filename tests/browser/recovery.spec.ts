import {startGame,reloadGame,openLevels,resumeGame} from './navigation';
import {test,expect,type Page} from '@playwright/test';import {readFileSync} from 'node:fs';import {layout} from '../../src/game/geometry';
const levels=JSON.parse(readFileSync(new URL('../../src/core/levels.json',import.meta.url),'utf8'));
const fresh=()=>({schema:1,artVersion:4,current:0,revision:0,completed:[] as string[],attempts:{},settings:{sound:true,fast:false,symbols:false,light:false}});
async function seed(page:Page,s=fresh()){await page.addInitScript(s=>{if(!sessionStorage.seed){localStorage.setItem('water-sort-v1',JSON.stringify(s));sessionStorage.seed='1';}},s);}
async function points(page:Page){await resumeGame(page);await page.locator('canvas').waitFor();await page.waitForTimeout(150);const b=(await page.locator('#board').boundingBox())!,ps=layout(b.width,b.height,4);return async(i:number)=>page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);}
async function failWrites(page:Page){await page.evaluate(()=>{const original=Storage.prototype.setItem;(window as any).restoreWrites=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(k,v){if(k.startsWith('water-sort-v1'))throw new DOMException('full','QuotaExceededError');return original.call(this,k,v);};});}
for(const getter of [false,true])test(`read failure is retryable and cannot overwrite progress (${getter?'getter':'getItem'})`,async({page})=>{
 const m=levels[0].witness[0],board=levels[0].initial.map((t:number[])=>[...t]);board[m.to].push(...board[m.from].splice(-m.amount));await seed(page,{...fresh(),attempts:{[`${levels[0].id}@${levels[0].version}`]:{board,history:[m],extra:false}}});await page.addInitScript(getter=>{const original=Object.getOwnPropertyDescriptor(window,'localStorage')!,storage=window.localStorage,get=Storage.prototype.getItem;(window as any).restoreRead=()=>{Object.defineProperty(window,'localStorage',original);Storage.prototype.getItem=get;};
 if(getter)Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('blocked','SecurityError');}});
 else Storage.prototype.getItem=function(k){if(k.startsWith('water-sort-v1'))throw new DOMException('blocked','SecurityError');return get.call(this,k);};
 (window as any).rawSave=()=>get.call(storage,'water-sort-v1');},getter);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await startGame(page);await expect(page.getByRole('heading',{name:'Прогресс недоступен'})).toBeVisible();const before=await page.evaluate(()=>(window as any).rawSave());await page.getByRole('button',{name:'Повторить чтение'}).click();expect(await page.evaluate(()=>(window as any).rawSave())).toBe(before);await page.keyboard.press('Escape');await expect(page.locator('dialog')).toBeVisible();await page.evaluate(()=>(window as any).restoreRead());await page.getByRole('button',{name:'Повторить чтение'}).click();await expect(page.locator('dialog')).not.toBeVisible();const tap=await points(page);await tap(0);await tap(2);await expect(page.locator('#moves')).toHaveText('Ходов: 2');expect(errors).toEqual([]);
});

test('failed undo during flight settles the accepted board and restores controls',async({page})=>{
 await seed(page);await startGame(page);const tap=await points(page);await tap(0);await tap(2);await failWrites(page);await page.locator('#undo').click();await expect(page.locator('#hint')).toBeEnabled();await expect(page.locator('#status')).toContainText('Изменение не принято');await expect(page.locator('#moves')).toHaveText('Ходов: 1');await page.evaluate(()=>(window as any).restoreWrites());await page.locator('#undo').click();await expect(page.locator('#moves')).toHaveText('Ходов: 0');await expect(page.locator('#hint')).toBeEnabled();
});

test('failed level switch keeps the original level usable',async({page})=>{
 const s=fresh();s.completed=[levels[0].id];await seed(page,s);await startGame(page);const tap=await points(page);await tap(0);await tap(2);await openLevels(page);await failWrites(page);await page.getByRole('button',{name:'Уровень 2',exact:true}).click();await expect(page.locator('#level-title')).toHaveText('Уровень 1');await expect(page.locator('dialog')).toBeVisible();await expect(page.getByRole('alert')).toContainText('Изменение не принято');await page.getByRole('button',{name:'Закрыть',exact:true}).click();await resumeGame(page);await expect(page.locator('#hint')).toBeEnabled();await expect(page.locator('#moves')).toHaveText('Ходов: 1');
});

test('backup notice survives resize until a real board action',async({page})=>{
 await seed(page);await startGame(page);let tap=await points(page);await tap(0);await tap(2);await expect(page.locator('#hint')).toBeEnabled();await tap(1);await tap(0);await expect(page.locator('#hint')).toBeEnabled();await page.evaluate(()=>localStorage.setItem('water-sort-v1','broken'));await reloadGame(page);await expect(page.locator('#status')).toContainText('Откат к резервной копии');await page.setViewportSize({width:568,height:320});await page.waitForTimeout(350);await expect(page.locator('#status')).toContainText('Откат к резервной копии');await expect(page.locator('#moves')).toHaveText('Ходов: 1');tap=await points(page);await tap(1);await expect(page.locator('#status')).not.toContainText('резервной');
});

for(const lastLevel of [false,true])test(`victory target fits small viewports (${lastLevel?'last':'first'} level)`,async({page})=>{
 const current=lastLevel?11:0,l=levels[current];let board=l.initial.map((t:number[])=>[...t]);for(const m of l.witness)board[m.to].push(...board[m.from].splice(-m.amount));const s={...fresh(),current,completed:levels.slice(0,current+1).map((l:any)=>l.id),attempts:{[`${l.id}@${l.version}`]:{board,history:l.witness,extra:false}}};await seed(page,s);await startGame(page);
 for(const [width,height]of [[320,480],[568,320],[390,844]]){await page.setViewportSize({width,height});await expect(page.locator('#continue')).toBeVisible();const r=(await page.locator('#continue').boundingBox())!,feedback=(await page.locator('#feedback').boundingBox())!;expect(r.height).toBeGreaterThanOrEqual(48);expect(r.y).toBeGreaterThanOrEqual(feedback.y);expect(r.y+r.height).toBeLessThanOrEqual(feedback.y+feedback.height+.5);const nav=(await page.locator('nav').boundingBox())!;expect(r.x+r.width<=nav.x||r.y+r.height<=nav.y).toBe(true);}
});

test('cached vessels reproduce the same commands and symbols as a fresh render',async({page})=>{
 const s={...fresh(),current:11,completed:levels.slice(0,11).map((l:any)=>l.id)};await seed(page,s);await startGame(page);await points(page);
 await page.evaluate(async()=>{const path='/src/game/WaterScene.ts',m=await import(path),original=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).cacheScene=this;m.WaterScene.prototype.positions=original;return original.call(this);};});
 const b=(await page.locator('#board').boundingBox())!;await page.mouse.click(b.x+1,b.y+1);await page.waitForTimeout(800);
 for(const symbols of [false,true])for(const light of [false,true]){
  const result=await page.evaluate(async({symbols,light})=>{const s=(window as any).cacheScene;s.symbols=symbols;s.light=light;const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await frame();s.previousSignature='';await frame();const snapshot=()=>JSON.stringify({commands:s.ink.commandBuffer,labels:s.activeLabels.map((l:any)=>[l.x,l.y,l.text,l.style.fontSize])});const cached=snapshot();s.tubes.clear();s.previousSignature='';await frame();return {same:cached===snapshot(),entries:s.tubes.size};},{symbols,light});expect(result.same).toBe(true);expect(result.entries).toBe(10);
 }
});

for(const sound of [true,false])test(`audio hardware failure leaves moves and settings usable (sound=${sound})`,async({page})=>{
 const s=fresh();s.settings.sound=sound;await seed(page,s);
 await page.addInitScript(()=>{(window as any).audioAttempts=0;(window as any).AudioContext=class{constructor(){(window as any).audioAttempts++;throw new DOMException('Audio hardware unavailable','NotSupportedError');}};});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await startGame(page);const tap=await points(page);
 if(!sound)expect(await page.evaluate(()=>(window as any).audioAttempts)).toBe(0);
 await tap(0);await tap(2);await expect(page.locator('#hint')).toBeEnabled();await expect(page.locator('#moves')).toHaveText('Ходов: 1');
 await page.locator('#settings').click();await expect(page.locator('dialog')).toBeVisible();await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 await reloadGame(page);await points(page);await expect(page.locator('#moves')).toHaveText('Ходов: 1');expect(errors).toEqual([]);
 if(!sound)expect(await page.evaluate(()=>(window as any).audioAttempts)).toBe(0);
});
