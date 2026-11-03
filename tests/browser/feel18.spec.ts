import {home48} from './navigation';
import {advanceFrames} from './controlled-frames';
import {test,expect,type Page} from '@playwright/test';
import {fresh,levels,moved,displaySlots,attempt} from '../../src/core/session';
import {layout,goalLayout} from '../../src/game/geometry';
async function prepare(page:Page,last=true,index=0){
 let s={...fresh(),current:index};if(last)for(const m of levels[index].witness.slice(0,-1))s=moved(s,m);s.settings.sound=false;
 await page.addInitScript(s=>localStorage.setItem('water-sort-v1',JSON.stringify(s)),s);
 await page.goto('/');await page.locator('#home-play').click();await page.waitForTimeout(300);
 await page.evaluate(async()=>{const path='/src/game/WaterScene.ts',m=await import(path),fn=m.WaterScene.prototype.positions;
 m.WaterScene.prototype.positions=function(){(window as any).feelScene=this;return fn.call(this);};
 });
}
async function tap(page:Page,i:number){const b=(await page.locator('#board canvas').boundingBox())!,s=await page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!)),r=(levels[s.current].goal?goalLayout(b.width,b.height,displaySlots(s),0):layout(b.width,b.height,displaySlots(s)))[i];await page.mouse.click(b.x+r.x,b.y+r.y+r.h/2);}
async function finish(page:Page,index=0,controlled=false){const m=levels[index].witness.at(-1)!;await tap(page,m.from);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).feelScene)).toBe(true);
 if(controlled)await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));
 await page.evaluate(()=>{const s=(window as any).feelScene,w=window as any;w.beats=[];w.pops=[];const phase=s.onPhase,finale=s.onFinale;s.onPhase=(n:number,heavy:boolean)=>{w.beats.push({n,time:performance.now()});phase(n,heavy);};s.onFinale=(n:number,heavy:boolean)=>{const e=document.getElementById('victory-effects'),r=e?.getBoundingClientRect();w.pops.push({n,time:performance.now(),overlay:e&&r?{x:r.x,y:r.y,width:r.width,height:r.height,pointerEvents:getComputedStyle(e).pointerEvents}:null});finale(n,heavy);};});
 await tap(page,m.to);if(controlled)await advanceFrames(page,'feelScene',1600);await expect(page.locator('#continue')).toBeVisible();}
for(const [width,height]of [[1280,720],[390,844]])test(`fill beats and ordered pops overlap, while corks stay gone ${width}x${height}`,async({page})=>{
 await page.clock.install();await page.setViewportSize({width,height});await prepare(page);const before=(await page.locator('#board canvas').boundingBox())!;await finish(page,0,true);
 await expect.poll(()=>page.evaluate(()=>(window as any).pops.length)).toBe(2);
 const data=await page.evaluate(()=>({beats:(window as any).beats,pops:(window as any).pops,popped:[...(window as any).feelScene.popped]}));
 expect(data.beats.map((b:any)=>b.n)).toEqual([0,1,2]);expect(data.pops.map((b:any)=>b.n)).toEqual([0,1]);expect(data.pops[0].time).toBeLessThan(data.beats[2].time);expect(data.pops.at(-1).time).toBeGreaterThan(data.beats[2].time);expect(data.pops[1].time-data.pops[0].time).toBeGreaterThan(130);
 // Observe bounds and style during the final pop, while the overlay is attached.
 const box=data.pops.at(-1).overlay,view=page.viewportSize()!;expect(box).toMatchObject({x:0,y:0,width:view.width,height:view.height,pointerEvents:'none'});
 const after=(await page.locator('#board canvas').boundingBox())!;expect(after).toEqual(before);
 await advanceFrames(page,'feelScene',2400);expect(await page.evaluate(()=>[...(window as any).feelScene.popped])).toEqual(data.popped);await expect(page.locator('#victory-effects')).toHaveCount(0);await page.clock.resume();
});
test('select and deselect both disturb the liquid without accepting a move',async({page})=>{
 await prepare(page,false);await tap(page,0);
 await expect.poll(()=>page.evaluate(()=>(window as any).feelScene.settles.get(0)??0)).toBeGreaterThan(0);
 const first=await page.evaluate(()=>{const s=(window as any).feelScene;return {selected:s.selected,at:s.settles.get(0)};});expect(first.selected).toBe(0);expect(first.at).toBeGreaterThan(0);
 await page.waitForTimeout(80);await tap(page,0);await expect.poll(()=>page.evaluate(()=>(window as any).feelScene.selected)).toBe(null);
 await expect.poll(()=>page.evaluate(()=>(window as any).feelScene.settles.get(0))).toBeGreaterThan(first.at);await expect(page.locator('#moves')).toHaveText('Ходов: 0');
});
for(const index of [0,15])for(const [width,height]of [[320,480],[390,844],[568,320]])test(`result, stars and controls do not overlap level ${index+1}, ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});await prepare(page,true,index);await finish(page,index);await page.waitForTimeout(800);
 const boxes=await page.evaluate(()=>Object.fromEntries(['feedback','finish-title','earned-stars','continue','undo','shuffle','extra-tube'].map(id=>{const el=document.getElementById(id)!,r=el.getBoundingClientRect();return [id,{x:r.x,y:r.y,right:r.right,bottom:r.bottom,visible:el.getClientRects().length>0}];})));
 const row=boxes.feedback,next=boxes.continue;for(const id of ['finish-title','earned-stars','continue']){const b=boxes[id];expect(b.y).toBeGreaterThanOrEqual(row.y-1);expect(b.bottom).toBeLessThanOrEqual(row.bottom+1);expect(b.right).toBeLessThanOrEqual(width);}
 for(const id of ['finish-title','earned-stars'])expect(boxes[id].right).toBeLessThanOrEqual(next.x+1);
 if(width<height)for(const id of ['undo','shuffle','extra-tube'])if(boxes[id].visible)expect(boxes[id].y).toBeGreaterThanOrEqual(row.bottom);
 await expect(page.locator('#status')).toBeHidden();
 await page.locator('#continue').click();await expect(page.locator('#victory-effects')).toHaveCount(0);
});
test('reduced motion and interruption do not leave a full-screen effect behind',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await prepare(page);await finish(page);await page.waitForTimeout(950);await expect(page.locator('#victory-effects')).toBeVisible();await home48(page);await expect(page.locator('#victory-effects')).toHaveCount(0);await page.waitForTimeout(1200);await expect(page.locator('#victory-effects')).toHaveCount(0);
});

test('entrance reaches its resting slot even after a long first frame',async({page})=>{
 await prepare(page,false);const b=(await page.locator('#board canvas').boundingBox())!;await page.mouse.click(b.x+1,b.y+1);
 const data=await page.evaluate(()=>{const s=(window as any).feelScene;s.resetEffects();s.reveal();s.update();const first=s.hitPolygons.get(0)[0].y;s.entrance-=600;s.update();return {first,rest:s.positions()[0].y,last:s.hitPolygons.get(0)[0].y};});
 expect(data.first).toBeGreaterThan(data.rest+5);expect(data.last).toBeCloseTo(data.rest,3);
});

test('visible goal colour and star conditions fit above controls on a small phone',async({page})=>{
 await page.setViewportSize({width:320,height:480});await prepare(page,false,12);
 const data=await page.evaluate(()=>{const b=document.getElementById('star-target')!.getBoundingClientRect(),n=document.getElementById('undo')!.getBoundingClientRect();return {bottom:b.bottom,controls:n.y};});
 expect(data.bottom).toBeLessThanOrEqual(data.controls);await expect(page.locator('#objective')).toBeHidden();await expect(page.locator('#board')).toHaveAttribute('aria-label',/голубой/);const s=await page.evaluate(()=>JSON.parse(localStorage.getItem('water-sort-v1')!));expect(attempt(s).board[0]).toEqual([0,0]);await expect(page.locator('#moves')).toHaveText('Ходов: 0');
});
