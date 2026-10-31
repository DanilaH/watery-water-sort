import {startGame,reloadGame,openLevels,resumeGame,slotCount} from './navigation';
import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {layout} from '../../src/game/geometry';
const levels=JSON.parse(readFileSync(new URL('../../src/core/levels.json',import.meta.url),'utf8'));
const initial=(current=0)=>({schema:1,current,revision:0,completed:[],attempts:{},settings:{sound:true,fast:false,symbols:false,light:false}});
async function start(page:Page,index=0){await startGame(page);await page.evaluate(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),initial(index));await reloadGame(page);await expect(page.locator('canvas')).toBeVisible();await page.waitForTimeout(120);}
async function tap(page:Page,i:number,index=0){const b=(await page.locator('#board').boundingBox())!,p=layout(b.width,b.height,await slotCount(page))[i];await page.mouse.click(b.x+p.x,b.y+p.y+p.h/2);}
for(const manual of [false,true])test(`retina rendering preserves logical hit testing and real hint selection (${manual?'manual override':'hint recipient'})`,async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3});const page=await context.newPage();await start(page,2);
 const density=await page.locator('canvas').evaluate(c=>({backing:(c as HTMLCanvasElement).width,css:c.getBoundingClientRect().width}));expect(density.backing/density.css).toBeCloseTo(3,1);
 await page.locator('#hint').click();await expect(page.locator('#status')).toContainText('Перелей');
 if(manual){await tap(page,0,2);await tap(page,3,2);const from=await page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!).attempts['water-003@1'].history.at(-1).from);expect(from).toBe(0);}
 else{await tap(page,4,2);await expect(page.locator('#moves')).toHaveText('Ходов: 1');}
 await context.close();
});
test('victory remains actionable after final-move rotation and reload',async({page})=>{
 await page.setViewportSize({width:390,height:844});await start(page);
 for(const m of levels[0].witness.slice(0,2)){await tap(page,m.from);await tap(page,m.to);await page.waitForTimeout(620);}
 const m=levels[0].witness[2];await tap(page,m.from);await tap(page,m.to);await page.setViewportSize({width:844,height:390});await expect(page.locator('#continue')).toBeVisible();await reloadGame(page);await expect(page.locator('#continue')).toBeVisible();await page.locator('#continue').click();await expect(page.locator('#level-title')).toHaveText('Уровень 2');
});
test('blank tap cancels the queued move',async({page})=>{
 await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});await start(page);await page.clock.pauseAt(new Date('2026-01-01T00:00:10Z'));await tap(page,1);await tap(page,3);await tap(page,0);await tap(page,2);await expect(page.locator('#status')).toContainText('Следующий ход');
 const b=(await page.locator('#board').boundingBox())!;await page.mouse.click(b.x+3,b.y+b.height-4);await page.clock.runFor(700);await expect(page.locator('#moves')).toHaveText('Ходов: 1');
});
test('small landscape dialog keeps close and confirmation visible',async({page})=>{
 await page.setViewportSize({width:568,height:320});await start(page,11);await page.locator('#settings').click();
 for(const button of [page.getByRole('button',{name:'Закрыть',exact:true}),page.getByRole('button',{name:'Готово',exact:true})]){const r=(await button.boundingBox())!;expect(r.y).toBeGreaterThanOrEqual(0);expect(r.y+r.height).toBeLessThanOrEqual(320);}
 await page.getByRole('button',{name:'Закрыть',exact:true}).click();await expect(page.locator('dialog')).not.toBeVisible();
});

test('unavailable audio never delays accepting a move',async({page})=>{
 await page.route('**/audio/*.ogg',route=>route.fulfill({status:404,body:''}));await start(page);await tap(page,0);await tap(page,2);await expect(page.locator('#moves')).toHaveText('Ходов: 1');
});

test('manual selection cancels an in-flight hint without stealing input',async({page})=>{
 await page.route('**/solver.worker*',async route=>{await new Promise(resolve=>setTimeout(resolve,500));await route.continue().catch(()=>{});});await start(page,2);await page.locator('#hint').click();await tap(page,0,2);await page.waitForTimeout(650);await tap(page,3,2);
 const source=await page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!).attempts['water-003@1'].history.at(-1).from);expect(source).toBe(0);
});

test('dense field reserves one advertised slot outside the real board and keeps guidance quiet',async({page})=>{
 await page.setViewportSize({width:320,height:480});await start(page,11);await expect(page.locator('#status')).toHaveText('');
 const expected=levels[11].initial.length;
 await page.evaluate(async()=>{const path='/src/game/WaterScene.ts',m=await import(path),original=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(this:any){const poses=original.call(this);(window as any).__field={slots:this.slots,tubes:this.board.length,poses:poses.length};m.WaterScene.prototype.positions=original;return poses;};});
 await tap(page,0,11);const actual=await page.evaluate(()=>(window as any).__field);
 expect(actual).toEqual({slots:expected+1,tubes:expected,poses:expected+1});await expect(page.locator('#extra-tube')).toBeVisible();await expect(page.locator('#status')).toContainText('Выбери');
});

for(const [width,height]of [[390,844],[320,480],[568,320]])test(`controls retain 48px touch areas ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});await start(page,11);
  for(const id of ['menu','settings','undo','hint','restart']){const b=(await page.locator('#'+id).boundingBox())!;expect(b.width).toBeGreaterThanOrEqual(48);expect(b.height).toBeGreaterThanOrEqual(48);expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(width);expect(b.y+b.height).toBeLessThanOrEqual(height);}
  await page.locator('#settings').click();const close=page.getByRole('button',{name:'Закрыть',exact:true}),b=(await close.boundingBox())!;expect(b.width+0.001).toBeGreaterThanOrEqual(48);expect(b.height+0.001).toBeGreaterThanOrEqual(48);await close.click();
});


test('an already earned extra tube survives the layout change and remains usable',async({page})=>{
 await page.setViewportSize({width:390,height:844});await startGame(page);
 const state={...initial(),attempts:{[`${levels[0].id}@${levels[0].version}`]:{board:[...levels[0].initial,[]],history:[],extra:true}}};
 await page.evaluate(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),state);await reloadGame(page);await page.locator('canvas').waitFor();await page.waitForTimeout(150);
 const b=(await page.locator('#board').boundingBox())!,ps=layout(b.width,b.height,5);
 for(const i of [0,4]){const p=ps[i];await page.mouse.click(b.x+p.x,b.y+p.y+p.h/2);}
 await expect(page.locator('#moves')).toHaveText('Ходов: 1');
 const extra=await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('water-sort-v1')!).attempts)[0] as {board:number[][];extra:boolean});expect(extra.extra).toBe(true);expect(extra.board).toHaveLength(5);expect(extra.board[4]).toHaveLength(2);
});
