import {test,expect,type Page} from '@playwright/test';
import {fresh,moved,attempt,goalFor,displaySlots} from '../../src/core/session';
import {moveFor} from '../../src/core/rules';
import {goalLayout} from '../../src/game/geometry';
async function open(page:Page,partial=false){let s={...fresh(),current:12};if(partial)for(const [from,to]of [[3,0],[2,0],[1,4]])s=moved(s,moveFor(attempt(s).board,from,to,goalFor(s))!);s.settings.sound=false;
 await page.addInitScript(s=>{if(sessionStorage.crystal20)return;sessionStorage.crystal20='1';localStorage.setItem('water-sort-v1',JSON.stringify(s));},s);await page.goto('/');await page.locator('#home-play').click();await page.waitForTimeout(350);
 await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).crystalScene=this;return fn.call(this);};});await page.locator('#symbols').click();await expect.poll(()=>page.evaluate(()=>(window as any).crystalScene?.crystalBase?.visible)).toBe(true);
}
async function tap(page:Page,index:number){const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!)),b=(await page.locator('#board').boundingBox())!,r=goalLayout(b.width,b.height,displaySlots(state),0)[index];await page.mouse.click(b.x+r.x,b.y+r.y+r.h/2);}
for(const [width,height]of [[320,480],[390,844],[568,320]])test(`approved pedestal is loaded, fits the field and survives a cached redraw ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});await open(page);
 const result=await page.evaluate(()=>{const s=(window as any).crystalScene,b=s.crystalBase,r=b.getBounds();s.previousSignature='';s.update();return {key:b.texture.key,source:{w:b.texture.getSourceImage().width,h:b.texture.getSourceImage().height},x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:s.viewWidth*s.density,height:s.viewHeight*s.density,visible:b.visible,shards:s.crystalShards.filter((x:any)=>x.visible).length};});
 expect(result.key).toBe('goal-crystal-base');expect(result.source).toEqual({w:512,h:234});expect(result.visible).toBe(true);expect(result.shards).toBe(0);expect(result.x).toBeGreaterThanOrEqual(0);expect(result.right).toBeLessThanOrEqual(result.width);expect(result.bottom).toBeLessThanOrEqual(result.height);expect(result.y).toBeGreaterThanOrEqual(0);
});
async function record(page:Page){await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.pedestal;(window as any).crystalFrames=[];m.WaterScene.prototype.pedestal=function(...args:any[]){const value=fn.apply(this,args);(window as any).crystalFrames.push({complete:args[1],base:this.crystalBase.visible,alpha:this.crystalBase.alpha,pieces:this.crystalShards.filter((s:any)=>s.visible).map((s:any)=>s.texture.key)});return value;};});}
test('art breaks into five textured pieces at visual fill; reload hides it and Undo restores it',async({page})=>{
 await open(page,true);await record(page);await tap(page,1);await tap(page,0);
 await expect.poll(()=>page.evaluate(()=>(window as any).crystalFrames.some((f:any)=>f.complete&&!f.base&&f.pieces.length===5))).toBe(true);
 const frames=await page.evaluate(()=>(window as any).crystalFrames);expect(frames.filter((f:any)=>!f.complete).every((f:any)=>f.pieces.length===0)).toBe(true);expect(frames.flatMap((f:any)=>f.pieces).every((key:string)=>key.startsWith('goal-crystal-shard-'))).toBe(true);
 await expect.poll(()=>page.evaluate(()=>(window as any).crystalScene.crystalShards.some((s:any)=>s.visible))).toBe(false);await expect(page.locator('#continue')).toBeHidden();
 await page.reload();await page.locator('#home-play').click();await page.waitForTimeout(300);await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).reloadedCrystal=this;return fn.call(this);};});await page.locator('#symbols').click();await expect.poll(()=>page.evaluate(()=>(window as any).reloadedCrystal?.crystalBase.visible)).toBe(false);
 await page.locator('#undo').click();await expect.poll(()=>page.evaluate(()=>(window as any).reloadedCrystal?.crystalBase.visible)).toBe(true);
});
test('reduced motion fades the whole pedestal without moving fragments; home clears sprites',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await open(page,true);await record(page);await tap(page,1);await tap(page,0);
 await expect.poll(()=>page.evaluate(()=>(window as any).crystalFrames.some((f:any)=>f.complete&&f.base&&f.alpha>0&&f.alpha<1))).toBe(true);expect(await page.evaluate(()=>(window as any).crystalFrames.every((f:any)=>f.pieces.length===0))).toBe(true);
 await expect.poll(()=>page.evaluate(()=>(window as any).crystalScene.crystalBase.visible)).toBe(false);await page.locator('#menu').click();expect(await page.evaluate(()=>{const s=(window as any).crystalScene;return s.crystalBase.visible||s.crystalShards.some((s:any)=>s.visible);})).toBe(false);
});
