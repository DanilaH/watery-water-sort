import {test,expect} from '@playwright/test';
import {fresh,levels,moved,displaySlots,attempt,goalFor} from '../../src/core/session';
import {moveFor} from '../../src/core/rules';
import {goalLayout} from '../../src/game/geometry';
test('giant cork stays inside the field through its completion in landscape',async({page})=>{
 await page.setViewportSize({width:568,height:320});let s={...fresh(),current:12};s.settings.sound=false;
 for(const [from,to]of [[3,0],[2,0],[1,4]])s=moved(s,moveFor(attempt(s).board,from,to,goalFor(s))!);
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('/');await page.locator('#home-play').click();
 await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).sharedGlassScene=this;return fn.call(this);};});await page.locator('#symbols').click();await expect.poll(()=>page.evaluate(()=>!!(window as any).sharedGlassScene)).toBe(true);
 await page.evaluate(()=>{const s=(window as any).sharedGlassScene,g=s.glass,fn=g.cork;(window as any).corkYs=[];g.cork=function(...a:any[]){if(a[0]===0)(window as any).corkYs.push(a[2]);return fn.apply(this,a);};});
 const b=(await page.locator('#board').boundingBox())!,ps=goalLayout(b.width,b.height,displaySlots(s),0);for(const i of [1,0])await page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);
 await expect.poll(()=>page.evaluate(()=>(window as any).sharedGlassScene.board[0].length)).toBe(8);await page.waitForTimeout(1000);
 const ys=await page.evaluate(()=>(window as any).corkYs);expect(ys.length).toBeGreaterThan(3);expect(Math.min(...ys)).toBeGreaterThanOrEqual(3.9);expect(Math.max(...ys)-Math.min(...ys)).toBeGreaterThan(2);
});
test('locked slot uses shared glass, and its first click opens the reward offer',async({page})=>{
 const s={...fresh(),current:11};s.settings.sound=false;await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('/');await page.locator('#home-play').click();
 await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).sharedGlassScene=this;return fn.call(this);};});await page.locator('#symbols').click();
 await expect.poll(()=>page.evaluate(()=>{const s=(window as any).sharedGlassScene;return !!s?.lockedExtra&&s.glass.tubes.get(s.board.length)?.visible;})).toBe(true);
 await page.locator('#extra-tube').click();await expect(page.getByRole('heading',{name:'Дополнительная колба',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Смотреть рекламу',exact:true})).toBeVisible();
});
