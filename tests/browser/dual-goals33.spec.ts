import {test,expect,type Page} from '@playwright/test';
import {advanceFrames} from './controlled-frames';
import {fresh,levels,moved,attempt,goalFor,displaySlots,levelKey} from '../../src/core/session';
import {moveFor,won} from '../../src/core/rules';
import {goalLayout} from '../../src/game/geometry';
import {mockReward} from './navigation';
async function saved(page:Page){return page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!));}
async function open(page:Page,index=16,n=0){let s={...fresh(),current:index};s.completed=levels.slice(0,index).map(l=>l.id);s.settings.sound=false;for(const m of levels[index].witness.slice(0,n))s=moved(s,m);
 await page.addInitScript(s=>{if(sessionStorage.dual33)return;sessionStorage.dual33='1';localStorage.setItem('water-sort-v1',JSON.stringify(s));},s);await page.goto('/');
 await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).dualScene=this;return fn.call(this);};});
 await page.locator('#home-play').click();await page.waitForTimeout(300);return s;
}
async function tap(page:Page,i:number){const s=await saved(page),b=(await page.locator('#board').boundingBox())!,r=goalLayout(b.width,b.height,displaySlots(s),[0,1])[i];await page.mouse.click(b.x+r.x,b.y+r.y+r.h/2);}
async function move(page:Page,from:number,to:number){await tap(page,from);await tap(page,to);await expect(page.locator('#hint')).toBeEnabled();}

test('two targets teach colour matching, reject wrong receiver, preserve fixed Undo and real worker hint',async({page})=>{
 await open(page);await expect(page.locator('#objective')).toHaveText('Собери каждый цвет в свою большую колбу');await expect(page.locator('#extra-tube')).toBeHidden();
 await move(page,4,1);expect(attempt(await saved(page)).history).toHaveLength(0);
 await tap(page,0);await expect(page.locator('#hint')).toBeEnabled();expect(attempt(await saved(page)).board[0]).toHaveLength(4);
 await page.locator('#undo').click();await expect(page.locator('#status')).toContainText('остаётся на месте');expect(attempt(await saved(page)).board[0]).toEqual([]);
 await page.locator('#hint').click();await expect(page.locator('#status')).toContainText('Перелей');
 const hint=await page.evaluate(()=>(window as any).dualScene.hintMove),s=await saved(page);expect(hint).toEqual(moveFor(attempt(s).board,hint.from,hint.to,goalFor(s)));expect(hint.from).toBeGreaterThan(1);
 await tap(page,hint.to);await expect(page.locator('#hint')).toBeEnabled();expect(attempt(await saved(page)).history).toHaveLength(1);
 await page.reload();await page.locator('#home-play').click();expect(attempt(await saved(page)).history).toHaveLength(1);
});

test('first finished receiver has its own pedestal and heavy beats without winning the whole level',async({page})=>{
 await page.clock.install();let s={...fresh(),current:16},cut=0,index=0;for(const m of levels[16].witness){s=moved(s,m);cut++;if(attempt(s).board.some((t,i)=>i<2&&t.length===8)){index=m.to;break;}}
 await open(page,16,cut-1);await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));await page.evaluate(()=>{const s=(window as any).dualScene;(window as any).dualBeats=[];const f=s.onPhase;s.onPhase=(phase:number,heavy:boolean)=>{(window as any).dualBeats.push({phase,heavy});f(phase,heavy);};});
 const m=levels[16].witness[cut-1];await tap(page,m.from);await tap(page,m.to);await advanceFrames(page,'dualScene',1600);await expect(page.locator('#hint')).toBeEnabled();await expect(page.locator('#continue')).toBeHidden();
 await expect.poll(()=>page.evaluate(()=>(window as any).dualBeats.length)).toBe(3);expect(await page.evaluate(()=>(window as any).dualBeats.every((b:any)=>b.heavy))).toBe(true);
 await expect.poll(()=>page.evaluate(()=>{const s=(window as any).dualScene;return [s.crystalBase.visible,s.secondCrystalBase.visible];})).toEqual(index===0?[false,true]:[true,false]);
 expect(won(attempt(await saved(page)).board,goalFor(await saved(page)))).toBe(false);await page.clock.resume();
 await page.locator('#undo').click();await expect.poll(()=>page.evaluate(()=>{const s=(window as any).dualScene;return s.crystalBase.visible&&s.secondCrystalBase.visible;})).toBe(true);
});

for(const [width,height]of [[320,480],[390,844],[568,320]])test(`two-goal field and finale fit ${width}x${height}; replay resets both targets`,async({page})=>{
 await page.setViewportSize({width,height});await open(page,21,levels[21].witness.length-1);
 const ps=await page.evaluate(()=>(window as any).dualScene.positions());for(const p of ps){expect(p.hitW).toBeGreaterThanOrEqual(48);expect(p.hitH).toBeGreaterThanOrEqual(48);}
 const last=levels[21].witness.at(-1)!;await tap(page,last.from);await tap(page,last.to);await expect(page.locator('#continue')).toBeVisible();await expect(page.locator('#earned-stars')).toHaveText('★★★');
 const s=await saved(page);expect(attempt(s).board.slice(0,2).map(t=>t.length)).toEqual([8,8]);expect(s.best[levelKey(21)].history).toHaveLength(levels[21].witness.length);
 const boxes=await page.evaluate(()=>['board','feedback','continue'].map(id=>{const r=document.getElementById(id)!.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,h:r.height};}));for(const r of boxes){expect(r.x).toBeGreaterThanOrEqual(0);expect(r.right).toBeLessThanOrEqual(width);expect(r.bottom).toBeLessThanOrEqual(height);}expect(boxes[2].y).toBeGreaterThanOrEqual(boxes[0].bottom);
 await page.locator('#menu').click();await page.locator('#home-levels').click();await page.locator('.levels button').nth(21).click();expect(attempt(await saved(page)).board).toEqual(levels[21].initial);
});

test('reward appends ordinary buffer, survives reload and restart without changing either receiver',async({page})=>{
 await open(page,18,2);await mockReward(page);const before=await saved(page);await page.locator('#extra-tube').click();await page.getByRole('button',{name:'Смотреть рекламу',exact:true}).click();await expect(page.locator('dialog')).toBeHidden();expect(attempt(await saved(page)).board).toEqual([...attempt(before).board,[]]);
 await page.reload();await page.locator('#home-play').click();expect(attempt(await saved(page)).extra).toBe(true);await page.locator('#restart').click();await page.getByRole('button',{name:'Начать заново',exact:true}).click();expect(attempt(await saved(page)).board).toEqual([...levels[18].initial,[]]);
});
