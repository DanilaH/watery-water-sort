import {test,expect,type Page} from '@playwright/test';
import {fresh,levels,moved,attempt,type Save} from '../../src/core/session';
import {campaign} from '../../src/core/campaign';
async function open(page:Page,s:Save){s.settings.sound=false;await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);await page.goto('/');await page.evaluate(async()=>{const path='/src/game/WaterScene.ts',m=await import(path),fn=m.WaterScene.prototype.positions;m.WaterScene.prototype.positions=function(){(window as any).scene39=this;return fn.call(this);};});await page.locator('#home-play').click();await expect.poll(()=>page.evaluate(()=>!!(window as any).scene39?.ready)).toBe(true);await page.waitForTimeout(300);}
async function tap(page:Page,i:number){const b=(await page.locator('#board').boundingBox())!,r=await page.evaluate(i=>(window as any).scene39.positions()[i],i);await page.mouse.click(b.x+r.x,b.y+r.y+r.h/2);}
for(const fast of [false,true])test(`flow raises the rendered source lip and lands at its slot, fast=${fast}`,async({page})=>{
 await page.clock.install();const s={...fresh(),current:40};s.settings.fast=fast;await open(page,s);await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));
 await page.evaluate(()=>{const s=(window as any).scene39,fn=s.tube;s.tube=function(...a:any[]){if(this.flight?.from===a[5])this.sourcePose39={...a[0],angle:a[2]};return fn.apply(this,a);};});
 const m=levels[40].witness[0];await tap(page,m.from);await page.clock.fastForward(160);await page.evaluate(()=>(window as any).scene39.update());await tap(page,m.to);
 const sample=async(t:number)=>page.evaluate(t=>{const s=(window as any).scene39,f=s.flight;const elapsed=t<.25?t/.25*f.timing.lift:t<.73?f.timing.lift+(t-.25)/.48*f.timing.flow:f.timing.lift+f.timing.flow+(t-.73)/.27*f.timing.back;f.start=performance.now()-elapsed;s.update();const r=s.sourcePose39;return {lip:r.y+f.plan.dir*r.w/2*Math.sin(r.angle),x:r.x,y:r.y,slot:s.positions()[f.from]};},t);
 const a=await sample(.25),b=await sample(.729);expect(a.lip-b.lip).toBeGreaterThan(10);expect(a.lip-b.lip).toBeLessThanOrEqual(14.01);
 const end=await sample(.999999);expect(end.x).toBeCloseTo(end.slot.x,3);expect(end.y).toBeCloseTo(end.slot.y,3);
 await page.clock.fastForward(200);await page.evaluate(()=>(window as any).scene39.update());expect(await page.evaluate(()=>(window as any).scene39.busy)).toBe(false);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!));expect(attempt(saved).history).toEqual([m]);await page.clock.resume();
});
test('a completed old final puzzle continues to stage 41 with existing records intact',async({page})=>{
 let s={...fresh(),current:11,completed:campaign.slice(0,40).map(i=>levels[i].id)};for(const m of levels[11].witness)s=moved(s,m);const best=structuredClone(s.best);
 await open(page,s);await expect(page.locator('#level-title')).toHaveText('Уровень 40');await expect(page.locator('#continue')).toHaveText('Дальше →');await page.locator('#continue').click();await expect(page.locator('#level-title')).toHaveText('Уровень 41');
 const loaded=await page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!));expect(loaded.current).toBe(40);expect(loaded.best).toEqual(best);expect(attempt(loaded).board).toEqual(levels[40].initial);
});
