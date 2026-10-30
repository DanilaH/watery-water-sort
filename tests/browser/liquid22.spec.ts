import {test,expect,type Page} from '@playwright/test';
import {fresh,displaySlots} from '../../src/core/session';
import {layout} from '../../src/game/geometry';
async function open(page:Page,fast=false){const s=fresh();s.settings.sound=false;s.settings.fast=fast;
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('/');await page.locator('#home-play').click();await page.waitForTimeout(300);
 await page.evaluate(async()=>{const p='/src/game/WaterScene.ts',m=await import(p),fn=m.WaterScene.prototype.surfaceWave,land=m.WaterScene.prototype.land;(window as any).liquidFrames=[];(window as any).liquidImpacts=[];
  m.WaterScene.prototype.surfaceWave=function(...args:any[]){const v=fn.apply(this,args);(window as any).liquidScene=this;(window as any).liquidFrames.push({index:args[0],wave:v,busy:this.busy,received:!!this.flight?.received,time:performance.now()});return v;};
  m.WaterScene.prototype.land=function(i:number,...args:any[]){const before=this.liquid.get(i)?.x??0,result=land.call(this,i,...args);(window as any).liquidImpacts.push({i,before,after:this.liquid.get(i)?.x??0});return result;};
 });return s;
}
async function tap(page:Page,index:number,s:ReturnType<typeof fresh>){const b=(await page.locator('#board').boundingBox())!,r=layout(b.width,b.height,displaySlots(s))[index];await page.mouse.click(b.x+r.x,b.y+r.y+r.h/2);}
for(const fast of [false,true])test(`liquid survives receiving and return, settles and clears on navigation (${fast?'fast':'normal'})`,async({page})=>{
 const s=await open(page,fast);await tap(page,1,s);await page.waitForTimeout(60);await tap(page,3,s);
 await expect.poll(()=>page.evaluate(()=>(window as any).liquidFrames.some((f:any)=>f.index===3&&f.received&&Math.abs(f.wave)>.1))).toBe(true);
 await expect.poll(()=>page.evaluate(()=>(window as any).liquidFrames.some((f:any)=>f.index===3&&!f.busy&&Math.abs(f.wave)>.05))).toBe(true);
 const impacts=await page.evaluate(()=>(window as any).liquidImpacts);expect(impacts.some((x:any)=>x.i===3)).toBe(true);expect(impacts.every((x:any)=>x.before===x.after)).toBe(true);
 // Drive four seconds of simulation, independently of host rAF delivery.
 // runFor(4000) advances timers but does not guarantee 240 Phaser updates.
 await page.evaluate(()=>{const scene=(window as any).liquidScene;if(scene.busy)throw Error('Expected completed pour');for(let i=0;i<240;i++){scene.lastFrame=performance.now()-1000/60;scene.update();}});expect(await page.evaluate(()=>(window as any).liquidScene.liquid.size)).toBe(0);await page.locator('#menu').click();expect(await page.evaluate(()=>(window as any).liquidScene.liquid.size)).toBe(0);await expect(page.locator('#home')).toBeVisible();
});
test('reduced motion does not keep a decorative wave loop running',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});const s=await open(page);await tap(page,1,s);await tap(page,3,s);await page.waitForTimeout(700);expect(await page.evaluate(()=>(window as any).liquidFrames.every((f:any)=>f.wave===0))).toBe(true);expect(await page.evaluate(()=>(window as any).liquidScene.liquid.size)).toBe(0);
});
