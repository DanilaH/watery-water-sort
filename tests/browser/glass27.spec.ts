import {test,expect} from '@playwright/test';
import {fresh,levels,moved,displaySlots} from '../../src/core/session';
import {layout} from '../../src/game/geometry';
test('generated glass and cork survive cached redraws, disappear on Undo and clean up on exit',async({page})=>{
 const s=moved(fresh(),levels[0].witness[0]);s.settings.sound=false;
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('/');await page.locator('#home-play').click();await page.waitForTimeout(300);
 await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).glassScene=this;return fn.call(this);};});
 await page.locator('#symbols').click();await expect.poll(()=>page.evaluate(()=>!!(window as any).glassScene)).toBe(true);
 const b=(await page.locator('#board').boundingBox())!,poses=layout(b.width,b.height,displaySlots(s)),move=levels[0].witness[1];
 for(const i of [move.from,move.to])await page.mouse.click(b.x+poses[i].x,b.y+poses[i].y+poses[i].h/2);
 await expect.poll(()=>page.evaluate(i=>(window as any).glassScene.glass.corkVisible(i),move.to)).toBe(true);
 await page.waitForTimeout(2200);
 // Disturb another vessel; the completed one is restored from its settled cache.
 await page.mouse.click(b.x+poses[move.from].x,b.y+poses[move.from].y+poses[move.from].h/2);
 await expect.poll(()=>page.evaluate(i=>{const s=(window as any).glassScene;return {glass:s.glass.tubes.get(i)?.visible,cork:s.glass.corkVisible(i)};},move.to)).toEqual({glass:true,cork:true});
 await page.locator('#undo').click();await expect.poll(()=>page.evaluate(i=>(window as any).glassScene.glass.corkVisible(i),move.to)).toBe(false);
 await page.locator('#menu').click();await expect(page.locator('#home')).toBeVisible();expect(await page.evaluate(()=>{const s=(window as any).glassScene;return [...s.glass.corks.values()].filter((v:any)=>v.visible).length+s.flyingInk.commandBuffer.length;})).toBe(0);
});

test('switching from ordinary to giant does not restore an old small glass over the goal',async({page})=>{
 const s=fresh();s.completed=levels.slice(0,12).map(l=>l.id);s.settings.sound=false;
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('/');await page.locator('#home-play').click();
 await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).glassScene=this;return fn.call(this);};});
 await page.locator('#symbols').click();await expect.poll(()=>page.evaluate(()=>(window as any).glassScene?.glass.tubes.get(0)?.visible)).toBe(true);
 await page.locator('#menu').click();await page.locator('#home-levels').click();await page.locator('.levels button').nth(12).click();await expect(page.locator('#level-title')).toHaveText('Уровень 13');await page.waitForTimeout(900);
 await page.locator('#symbols').click();await page.waitForTimeout(100);
 expect(await page.evaluate(()=>{const s=(window as any).glassScene;return {goal:s.goal.index,oldGlass:s.glass.tubes.get(0).visible,ordinary:[...s.glass.tubes.entries()].some(([i,v]:any)=>i!==0&&v.visible)};})).toEqual({goal:0,oldGlass:false,ordinary:true});
});
