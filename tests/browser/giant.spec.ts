import {campaign,stageNumber} from '../../src/core/campaign';
import {levelButton} from './navigation';
import {toggleSymbols} from './navigation';
import {test,expect,type Page} from '@playwright/test';
import {fresh,levels,moved,attempt,goalFor,displaySlots,levelKey} from '../../src/core/session';
import {goalLayout} from '../../src/game/geometry';
import {moveFor} from '../../src/core/rules';
import {mockReward} from './navigation';
async function seed(page:Page,index=12,history=0){let s={...fresh(),current:index,completed:campaign.slice(0,stageNumber(index)-1).map(i=>levels[i].id)};for(const m of levels[index].witness.slice(0,history))s=moved(s,m);s.settings.sound=false;
 await page.addInitScript(s=>{if(sessionStorage.giant17)return;sessionStorage.giant17='1';localStorage.setItem('water-sort-v1',JSON.stringify(s));},s);await page.goto('/');await page.locator('#home-play').click();await page.waitForTimeout(280);return s;}
async function saved(page:Page){return page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!));}
async function tap(page:Page,index:number){const s=await saved(page),b=(await page.locator('#board').boundingBox())!,ps=goalLayout(b.width,b.height,displaySlots(s),0),p=ps[index];await page.mouse.click(b.x+p.x,b.y+p.y+p.h/2);}
async function move(page:Page,from:number,to:number){await tap(page,from);await tap(page,to);}
test('first goal teaches its rules, rejects wrong colours and pouring back, survives Undo/reload',async({page})=>{
 const initial=await seed(page);await expect(page.locator('#objective')).toContainText('Собери голубую жидкость в большую колбу');await expect(page.locator('#extra-tube')).toBeHidden();
 await move(page,1,0);await expect(page.locator('#moves')).toHaveText('Ходов: 0');await expect(page.locator('#status')).toContainText('свой цвет');
 await move(page,3,0);await expect(page.locator('#hint')).toBeEnabled();let s=await saved(page);expect(attempt(s).board[0]).toHaveLength(4);
 await move(page,0,4);expect(attempt(await saved(page)).history).toHaveLength(1);
 await page.reload();await page.locator('#home-play').click();expect(attempt(await saved(page)).board[0]).toHaveLength(4);
 await page.locator('#undo').click();await expect(page.locator('#hint')).toBeEnabled();s=await saved(page);expect(attempt(s).board).toEqual(attempt(initial).board);
});
test('goal fill remains tall, completes once, records exact stars; next and replay stay usable',async({page})=>{
 await seed(page,12,levels[12].witness.length-1);await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),f=m.WaterScene.prototype.animate;m.WaterScene.prototype.animate=function(...args:any[]){(window as any).giantScene=this;return f.apply(this,args);};});
 const last=levels[12].witness.at(-1)!;await move(page,last.from,last.to);await expect(page.locator('#continue')).toBeVisible();await expect(page.locator('#earned-stars')).toHaveText('★★★');
 const s=await saved(page);expect(attempt(s).board[0]).toHaveLength(8);expect(s.best[levelKey(12)].history).toHaveLength(4);
 const sizes=await page.evaluate(()=>{const s=(window as any).giantScene,ps=s.positions();return {goal:ps[0].h,top:ps[0].y,bankTop:Math.min(...ps.slice(1).map((p:any)=>p.y)),bankBottom:Math.max(...ps.slice(1).map((p:any)=>p.y+p.h)),slots:s.slots};});expect(sizes.top).toBeCloseTo(sizes.bankTop,5);expect(sizes.top+sizes.goal).toBeCloseTo(sizes.bankBottom,5);
 await page.waitForTimeout(1700);const after=await page.evaluate(()=>(window as any).giantScene.positions()[0].h);expect(after).toBe(sizes.goal);
 await page.locator('#continue').click();await expect(page.locator('#level-title')).toHaveText('Уровень 5');await page.locator('#menu').click();await page.locator('#home-levels').click();await levelButton(page,12).click();expect(attempt(await saved(page)).board[0]).toEqual([]);expect((await saved(page)).best[levelKey(12)].history).toHaveLength(4);
});
test('real worker hint understands the locked receiver and its current fill',async({page})=>{
 await seed(page,13,3);await page.locator('#hint').click();await expect(page.locator('#status')).toContainText('Перелей');
 await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),f=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).giantScene=this;return f.call(this);};});
 const b=(await page.locator('#board').boundingBox())!;await page.mouse.click(b.x+1,b.y+1);
 await page.locator('#hint').click();await expect(page.locator('#status')).toContainText('Перелей');const hint=await page.evaluate(()=>(window as any).giantScene.hintMove);const s=await saved(page);expect(hint).toEqual(moveFor(attempt(s).board,hint.from,hint.to,goalFor(s)));expect(hint.from).not.toBe(0);
 await tap(page,hint.to);await expect(page.locator('#moves')).toHaveText('Ходов: 4');
});
test('rewarded ordinary slot preserves the goal, all accepted moves and Undo',async({page})=>{
 await seed(page,13,3);await mockReward(page);const before=await saved(page);
 await page.locator('#extra-tube').click();await page.getByRole('button',{name:'Смотреть рекламу',exact:true}).click();await expect(page.locator('dialog')).toBeHidden();const after=await saved(page);expect(attempt(after).board).toEqual([...attempt(before).board,[]]);expect(attempt(after).history).toEqual(attempt(before).history);
 await page.locator('#undo').click();await expect(page.locator('#hint')).toBeEnabled();expect(attempt(await saved(page)).history).toHaveLength(2);
 await page.locator('#restart').click();await page.getByRole('button',{name:'Начать заново',exact:true}).click();expect(attempt(await saved(page)).board).toEqual([...levels[13].initial,[]]);
});
for(const [width,height]of [[320,480],[568,320],[390,844]])test(`large-goal field and result fit ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});await seed(page,15,levels[15].witness.length-1);const m=levels[15].witness.at(-1)!;await move(page,m.from,m.to);await expect(page.locator('#continue')).toBeVisible();
 const boxes=await page.evaluate(()=>['board','feedback','continue'].map(id=>{const r=document.getElementById(id)!.getBoundingClientRect();return {id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,h:r.height};}));
 for(const r of boxes){expect(r.x).toBeGreaterThanOrEqual(0);expect(r.right).toBeLessThanOrEqual(width);expect(r.bottom).toBeLessThanOrEqual(height);}
 const button=boxes[2],board=boxes[0];expect(button.h).toBeGreaterThanOrEqual(48);expect(button.y).toBeGreaterThanOrEqual(board.bottom);
 await page.locator('#continue').click();await expect(page.locator('#level-title')).toHaveText('Уровень 34');
});
test('Undo out of the goal restores layers without lifting the fixed receiver',async({page})=>{
 await seed(page,12,1);await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.animate;(window as any).goalFlights=[];m.WaterScene.prototype.animate=function(...args:any[]){(window as any).goalFlights.push(args[1]);return fn.apply(this,args);};});
 await page.locator('#undo').click();await expect(page.locator('#status')).toContainText('остаётся на месте');expect(await page.evaluate(()=>(window as any).goalFlights)).toEqual([]);expect(attempt(await saved(page)).board[0]).toEqual([]);await expect(page.locator('#hint')).toBeEnabled();
});
test('a goal may finish before the level; its completion neither wins nor disables remaining moves',async({page})=>{
 let s={...fresh(),current:12};for(const [from,to]of [[3,0],[2,0],[1,4]])s=moved(s,moveFor(attempt(s).board,from,to,goalFor(s))!);s.settings.sound=false;
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('/');await page.locator('#home-play').click();await page.waitForTimeout(280);await move(page,1,0);await expect(page.locator('#hint')).toBeEnabled();await expect(page.locator('#continue')).toBeHidden();expect(attempt(await saved(page)).board[0]).toHaveLength(8);
 await move(page,4,2);await expect(page.locator('#continue')).toBeVisible();await expect(page.locator('#earned-stars')).toHaveText('★★☆');
});
test('queued deliveries fill only their accepted portions without a premature colour reward',async({page})=>{
 await page.clock.install();await seed(page);await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));await page.evaluate(async()=>{const p='/src/audio/sound.ts',m=await import(p),fn=m.Sound.prototype.finish;(window as any).goalFinishes=[];m.Sound.prototype.finish=function(...args:any[]){(window as any).goalFinishes.push(args);return fn.apply(this,args);};});
 for(const i of [3,0,2,0])await tap(page,i);await expect(page.locator('#status')).toContainText('Следующий ход');await page.clock.resume();await expect(page.locator('#moves')).toHaveText('Ходов: 2');await expect(page.locator('#hint')).toBeEnabled();
 expect(attempt(await saved(page)).board[0]).toHaveLength(6);expect(await page.evaluate(()=>(window as any).goalFinishes)).toEqual([]);await expect(page.locator('#continue')).toBeHidden();
});
test('symbol mode identifies an empty goal by the same mark as its required colour',async({page})=>{
 await seed(page,13);await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).symbolGoalScene=this;return fn.call(this);};});
 await toggleSymbols(page);await expect.poll(()=>page.evaluate(()=>{const s=(window as any).symbolGoalScene;if(!s)return false;return s.activeLabels.some((l:any)=>l.text==='◆'&&Math.abs(l.x-s.positions()[0].x)<1);})).toBe(true);
});
