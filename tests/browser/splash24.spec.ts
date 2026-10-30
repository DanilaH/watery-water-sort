import {test,expect,type Page} from '@playwright/test';
import {fresh,levels,moved,displaySlots} from '../../src/core/session';
import {layout} from '../../src/game/geometry';
async function open(page:Page){let s=fresh();for(const m of levels[0].witness.slice(0,-1))s=moved(s,m);s.settings.sound=false;
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('/');await page.locator('#home-play').click();await page.waitForTimeout(300);
 await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).splashScene=this;return fn.call(this);};});await page.locator('#symbols').click();await expect.poll(()=>page.evaluate(()=>!!(window as any).splashScene)).toBe(true);
 await page.evaluate(()=>{const o=(window as any).splashScene.overlay,fn=o.sprite;(window as any).splashCalls=[];o.sprite=function(...args:any[]){(window as any).splashCalls.push({kind:args[2],alpha:args[7]});return fn.apply(this,args);};});return s;
}
async function finish(page:Page,s:ReturnType<typeof fresh>){const b=(await page.locator('#board').boundingBox())!,ps=layout(b.width,b.height,displaySlots(s)),m=levels[0].witness.at(-1)!;for(const i of [m.from,m.to])await page.mouse.click(b.x+ps[i].x,b.y+ps[i].y+ps[i].h/2);await expect(page.locator('#continue')).toBeVisible();}
test('generated sprites load, draw all six forms on real victory and clear on navigation',async({page})=>{
 const s=await open(page);const assets=await page.evaluate(()=>{const s=(window as any).splashScene;return Array.from({length:6},(_,i)=>{const image=s.textures.get(`splash-${i}`).getSourceImage();return {width:image.width,height:image.height,key:s.textures.get(`splash-${i}`).key};});});expect(assets).toHaveLength(6);for(const [i,a]of assets.entries()){expect(a.width).toBe(i===3?512:128);expect(a.height).toBe(i===3?512:128);expect(a.key).toMatch(/^splash-[0-5]$/);}
 await finish(page,s);await expect.poll(()=>page.evaluate(()=>new Set((window as any).splashCalls.map((x:any)=>x.kind)).size)).toBe(6);await expect(page.locator('#victory-effects')).toHaveCSS('pointer-events','none');await page.locator('#menu').click();await expect(page.locator('#victory-effects')).toHaveCount(0);
});
test('reduced motion keeps the quiet success accent without sprite fountains',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});const s=await open(page);await finish(page,s);await page.waitForTimeout(1000);expect(await page.evaluate(()=>(window as any).splashCalls.length)).toBe(0);await page.locator('#menu').click();await expect(page.locator('#victory-effects')).toHaveCount(0);
});
