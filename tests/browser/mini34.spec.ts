import {toggleSymbols} from './navigation';
import {test,expect,type Page} from '@playwright/test';
import {fresh,levels,moved,attempt,goalFor,displaySlots,levelKey} from '../../src/core/session';
import {moveFor,capacityAt,goalList,won} from '../../src/core/rules';
import {layout,goalLayout,miniLayout} from '../../src/game/geometry';
import {mockReward} from './navigation';
async function saved(page:Page){return page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!));}
async function open(page:Page,index=22,n=0){let s={...fresh(),current:index};s.completed=levels.slice(0,index).map(l=>l.id);s.settings.sound=false;for(const m of levels[index].witness.slice(0,n))s=moved(s,m);
 await page.addInitScript(s=>{if(sessionStorage.mini34)return;sessionStorage.mini34='1';localStorage.setItem('water-sort-v1',JSON.stringify(s));},s);await page.goto('/');
 await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).miniScene=this;return fn.call(this);};});
 await page.locator('#home-play').click();await page.waitForTimeout(300);return s;
}
async function tap(page:Page,i:number){const s=await saved(page),b=(await page.locator('#board').boundingBox())!,gs=goalList(goalFor(s)),ps=miniLayout(gs.length?goalLayout(b.width,b.height,displaySlots(s),gs.map(g=>g.index)):layout(b.width,b.height,displaySlots(s)),levels[s.current].mini),r=ps[i];await page.mouse.click(b.x+r.x,b.y+r.y+r.h/2);}
async function move(page:Page,from:number,to:number){await tap(page,from);await tap(page,to);await expect(page.locator('#hint')).toBeEnabled();}

test('full mini is a two-unit buffer, never a finished colour; save, Undo and restart retain its role',async({page})=>{
 await open(page);await expect(page.locator('#objective')).toHaveText('Собери цвета · мини-колбу оставь пустой');
 await page.evaluate(()=>{const s=(window as any).miniScene;(window as any).miniPhases=[];s.onPhase=(...a:any[])=>(window as any).miniPhases.push(a);});
 await move(page,1,0);const s=await saved(page);expect(attempt(s).board[0]).toHaveLength(2);expect(capacityAt(goalFor(s),0)).toBe(2);await expect(page.locator('#continue')).toBeHidden();
 expect(await page.evaluate(()=>{const s=(window as any).miniScene;return {phases:(window as any).miniPhases,cork:s.glass.corkVisible(0),label:s.activeLabels.some((l:any)=>l.text==='МИНИ')};})).toEqual({phases:[],cork:false,label:false});
 await page.reload();await page.locator('#home-play').click();expect(attempt(await saved(page)).board[0]).toHaveLength(2);await page.locator('#undo').click();await expect(page.locator('#hint')).toBeEnabled();expect(attempt(await saved(page)).board).toEqual(levels[22].initial);
 await page.locator('#restart').click();await page.getByRole('button',{name:'Начать заново',exact:true}).click();expect(attempt(await saved(page)).board[0]).toEqual([]);
});

test('mini pours with full-volume tilt and a lighter material cue; final transfer earns stars without popping the empty buffer',async({page})=>{
 await open(page,22,3);await page.evaluate(()=>{const s=(window as any).miniScene,fn=s.animate;s.animate=function(...a:any[]){const r=fn.apply(this,a);(window as any).miniStartUnits=this.flight.plan.startUnits;return r;};});await page.evaluate(async()=>{const p='/src/audio/sound.ts',m=await import(p),fn=m.Sound.prototype.pour;(window as any).miniPour=[];m.Sound.prototype.pour=function(...args:any[]){(window as any).miniPour.push(args);return fn.apply(this,args);};});
 await tap(page,0);await tap(page,2);expect(await page.evaluate(()=>(window as any).miniStartUnits)).toBe(4);await expect(page.locator('#continue')).toBeVisible();await expect(page.locator('#earned-stars')).toHaveText('★★★');
 const s=await saved(page);expect(attempt(s).board[0]).toEqual([]);expect(s.best[levelKey(22)].history).toHaveLength(4);expect(await page.evaluate(()=>(window as any).miniPour.some((a:any[])=>a[4]===true))).toBe(true);expect(await page.evaluate(()=>(window as any).miniScene.popped.has(0))).toBe(false);
 await page.locator('#continue').click();await expect(page.locator('#level-title')).toHaveText('Уровень 24');
});

test('real worker may choose the mini as a source and cannot treat it as a normal four-unit vessel',async({page})=>{
 await open(page,22,3);await page.locator('#hint').click();await expect(page.locator('#status')).toContainText('Перелей');const hint=await page.evaluate(()=>(window as any).miniScene.hintMove),s=await saved(page);expect(hint).toEqual(moveFor(attempt(s).board,hint.from,hint.to,goalFor(s)));expect(hint.from).toBe(0);await tap(page,hint.to);await expect(page.locator('#continue')).toBeVisible();
});

for(const [width,height]of [[320,480],[390,844],[568,320]])test(`mini plus paired goals fit ${width}x${height}; final buffer stays empty and replay starts fresh`,async({page})=>{
 await page.setViewportSize({width,height});await open(page,27,levels[27].witness.length-1);
 const data=await page.evaluate(()=>{const s=(window as any).miniScene,ps=s.positions();return {ps,small:ps[2],label:s.activeLabels.some((l:any)=>l.text==='МИНИ')};});expect(data.label).toBe(false);expect(data.small.h).toBeLessThan(data.ps[3].h);for(const p of data.ps){expect(p.hitW).toBeGreaterThanOrEqual(48);expect(p.hitH).toBeGreaterThanOrEqual(48);}
 const m=levels[27].witness.at(-1)!;await tap(page,m.from);await tap(page,m.to);await expect(page.locator('#continue')).toBeVisible();await expect(page.locator('#earned-stars')).toHaveText('★★★');const s=await saved(page);expect(won(attempt(s).board,goalFor(s))).toBe(true);expect(attempt(s).board[2]).toEqual([]);
 const boxes=await page.evaluate(()=>['board','continue'].map(id=>{const r=document.getElementById(id)!.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));for(const r of boxes){expect(r.x).toBeGreaterThanOrEqual(0);expect(r.right).toBeLessThanOrEqual(width);expect(r.bottom).toBeLessThanOrEqual(height);}expect(boxes[1].y).toBeGreaterThanOrEqual(boxes[0].bottom);
 await page.locator('#menu').click();await page.locator('#home-levels').click();await page.locator('.levels button').nth(27).click();expect(attempt(await saved(page)).board).toEqual(levels[27].initial);
});

test('reward grants a full-size four-unit tube beside the mini; actual transfer, reload and restart keep them separate',async({page})=>{
 await open(page,22,3);await mockReward(page);await page.locator('#extra-tube').click();await page.getByRole('button',{name:'Смотреть рекламу',exact:true}).click();await expect(page.locator('dialog')).toBeHidden();
 let s=await saved(page);const extra=attempt(s).board.length-1;expect(capacityAt(goalFor(s),extra)).toBe(4);await move(page,1,extra);s=await saved(page);expect(attempt(s).board[extra]).toHaveLength(4);expect(attempt(s).board[0]).toHaveLength(2);
 await page.reload();await page.locator('#home-play').click();expect(attempt(await saved(page)).board[extra]).toHaveLength(4);await page.locator('#undo').click();await expect(page.locator('#hint')).toBeEnabled();expect(attempt(await saved(page)).board[extra]).toEqual([]);
 await page.locator('#restart').click();await page.getByRole('button',{name:'Начать заново',exact:true}).click();expect(attempt(await saved(page)).board).toEqual([...levels[22].initial,[]]);
});

test('reduced motion and symbols keep the mini readable and fully playable',async({page})=>{
 await page.setViewportSize({width:320,height:480});await page.emulateMedia({reducedMotion:'reduce'});await open(page);await toggleSymbols(page);await move(page,1,0);expect(attempt(await saved(page)).board[0]).toHaveLength(2);expect(await page.evaluate(()=>{const s=(window as any).miniScene;return {reduced:s.reduced,label:s.activeLabels.some((l:any)=>l.text==='МИНИ'),cork:s.glass.corkVisible(0)};})).toEqual({reduced:true,label:false,cork:false});
});
