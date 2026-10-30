import {test,expect} from '@playwright/test';
import {fresh,displaySlots} from '../../src/core/session';
import {layout} from '../../src/game/geometry';
for(const dpr of [1,2,2.75,3])test(`smooth canvas resolution and real input survive resize at DPR ${dpr}`,async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:dpr}),page=await context.newPage(),s=fresh();s.settings.sound=false;
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('/');await page.locator('#home-play').click();await page.waitForTimeout(300);
 const check=async()=>{const b=(await page.locator('#board').boundingBox())!,c=await page.locator('#board canvas').evaluate((e:HTMLCanvasElement)=>({width:e.width,height:e.height})),scale=Math.min(3,Math.max(2,dpr));expect(c.width).toBeCloseTo(Math.round(b.width*scale),0);expect(c.height).toBeCloseTo(Math.round(b.height*scale),0);return b;};
 const b=await check(),ps=layout(b.width,b.height,displaySlots(s));for(const i of [1,3])await page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);await expect(page.locator('#moves')).toHaveText('Ходов: 1');await page.waitForTimeout(650);
 await page.setViewportSize({width:844,height:390});await expect.poll(async()=>{const b=(await page.locator('#board').boundingBox())!;return (await page.locator('#board canvas').evaluate((e:HTMLCanvasElement)=>e.width))===Math.round(b.width*Math.min(3,Math.max(2,dpr)));}).toBe(true);await check();await expect(page.locator('#moves')).toHaveText('Ходов: 1');await context.close();
});
